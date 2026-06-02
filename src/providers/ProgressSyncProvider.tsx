"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthProvider";
import { useSettings } from "@/components/SettingsProvider";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import {
  createEmptyStore,
  CURRENT_MIGRATION,
  getDeviceId,
  hasConflict,
  loadConflictPolicy,
  loadLocalProgress,
  mergeLatest,
  migrateFromV1,
  migrateLegacyEntries,
  saveConflictPolicy,
  saveLocalProgress,
  syncLegacyKeysToStore,
  type ConflictPolicyMode,
  type LocalProgressStore,
  type ProgressEntry,
  type ProgressStatus,
} from "@/lib/progress-sync";
import { buildLegacyMap, expandLegacyId } from "@/lib/legacy-map";
import type { PlaylistData } from "@/types";
import playlistInitial from "../../data/playlist.initial.json";
import type { CategoryOverrideValue } from "@/lib/storage";
import {
  deleteDeviceProgress,
  downloadProgress,
  deleteAllProgress,
  fetchAllDevicesProgress,
  fetchDevices,
  uploadProgress,
  upsertDevice,
  type DeviceRow,
  type RemoteProgressRow,
} from "@/lib/supabase-progress";
import { getDeviceLabel } from "@/lib/device-info";
import {
  ActionButton,
  VStack,
} from "@seed-design/react";
import {
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetFooter,
  BottomSheetRoot,
} from "@/ui/bottom-sheet";
import {
  RadioSelectBoxItem,
  RadioSelectBoxRadiomark,
  RadioSelectBoxRoot,
} from "@/ui/select-box";
import { Checkbox } from "@/ui/checkbox";

export type ProgressMergeMode = Exclude<ConflictPolicyMode, "ask">;

// Canonical legacy_video_id → content.id map, built ONCE at module load from the
// bundled v2 catalog snapshot (playlist.initial.json, 309 contents).
const LEGACY_MAP = buildLegacyMap(playlistInitial as unknown as PlaylistData);

// Custom DOM event dispatched after writing to legacy localStorage keys
export const SYNC_EVENT = "llt-progress-sync";
export function dispatchSyncEvent() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

// Upload fence (§4.4b): never upload a store whose legacy→content.id migration
// has not completed. A not-yet-migrated store may still hold legacy ids; the
// next loadSyncedLocalProgress will migrate it and upload then.
async function fencedUpload(
  store: LocalProgressStore,
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  userId: string,
  devId: string,
  entries: ProgressEntry[],
): Promise<void> {
  if (store.migratedSchema !== CURRENT_MIGRATION) return;
  await uploadProgress(supabase, userId, devId, entries);
}

// ── Context ──────────────────────────────────────────────────────────────────

interface ProgressSyncContextType {
  devices: DeviceRow[];
  devicesLoading: boolean;
  currentDeviceId: string;
  syncing: boolean;
  deleteDevice: (deviceId: string) => Promise<void>;
  mergeAllDevices: (mode?: ProgressMergeMode) => Promise<boolean>;
  adoptDeviceProgress: (sourceDeviceId: string) => Promise<void>;
  saveVideoProgress: (
    videoId: string,
    status: ProgressStatus,
    categoryOverride?: CategoryOverrideValue | "auto",
  ) => Promise<void>;
  resetConflictPolicy: () => void;
  refreshDevices: () => Promise<void>;
}

const ProgressSyncContext = createContext<ProgressSyncContextType>({
  devices: [],
  devicesLoading: false,
  currentDeviceId: "",
  syncing: false,
  deleteDevice: async () => {},
  mergeAllDevices: async () => false,
  adoptDeviceProgress: async () => {},
  saveVideoProgress: async () => {},
  resetConflictPolicy: () => {},
  refreshDevices: async () => {},
});

export function useProgressSync() {
  return useContext(ProgressSyncContext);
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function ProgressSyncProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { autoSync } = useSettings();
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictResolution, setConflictResolution] = useState<ConflictPolicyMode>("latest");
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [localWatchedCount, setLocalWatchedCount] = useState(0);
  const [remoteWatchedCount, setRemoteWatchedCount] = useState(0);
  const pendingRemoteRef = useRef<RemoteProgressRow[]>([]);
  const pendingLocalRef = useRef<LocalProgressStore | null>(null);
  const syncedSessionRef = useRef<string | null>(null);
  const deviceIdRef = useRef<string>("");
  const uploadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibilitySyncingRef = useRef(false);
  const conflictResolutionOptions: { value: ConflictPolicyMode; label: string; description: string }[] = [
    { value: "local", label: `이 기기 기록으로 맞추기 (${localWatchedCount}개)`, description: "다른 기기도 이 기기 기록으로 맞춰요." },
    { value: "remote", label: `저장된 기록으로 맞추기 (${remoteWatchedCount}개)`, description: "이 기기 기록을 저장된 기록으로 맞춰요." },
    { value: "latest", label: "자동으로 합치기", description: "영상마다 더 최근에 본 기록을 선택해요." },
  ];

  useEffect(() => {
    deviceIdRef.current = getDeviceId();
  }, []);

  const doRefreshDevices = useCallback(async (userId: string) => {
    setDevicesLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      setDevices(await fetchDevices(supabase, userId));
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  const refreshDevices = useCallback(async () => {
    if (user) await doRefreshDevices(user.id);
  }, [user, doRefreshDevices]);

  // ── Legacy key helpers ────────────────────────────────────────────────────

  function writeLegacyKeys(entries: ProgressEntry[]) {
    const watchedIds = entries.filter((e) => e.status === "watched").map((e) => e.videoId);
    const overrides: Record<string, string | null> = {};
    for (const e of entries) {
      if (e.categoryOverride !== undefined) overrides[e.videoId] = e.categoryOverride ?? null;
    }
    localStorage.setItem("llt-watched", JSON.stringify(watchedIds));
    localStorage.setItem("llt-overrides", JSON.stringify(overrides));
  }

  // Legacy-AWARE remote ingestion choke point (§4.5). Each remote row's
  // video_id is expanded through expandLegacyId: a legacy split id emits one
  // entry per content.id (carrying the row's status/override/updated_at);
  // status-union (watched wins, max updated_at) when two rows resolve to the
  // same content.id. Unknown ids are kept 1:1 so nothing is dropped.
  function remoteToEntries(remote: RemoteProgressRow[]): ProgressEntry[] {
    const byId = new Map<string, ProgressEntry>();

    const add = (entry: ProgressEntry) => {
      const existing = byId.get(entry.videoId);
      if (!existing) {
        byId.set(entry.videoId, entry);
        return;
      }
      const status: ProgressStatus =
        existing.status === "watched" || entry.status === "watched"
          ? "watched"
          : "unwatched";
      const updatedAt =
        existing.updatedAt >= entry.updatedAt ? existing.updatedAt : entry.updatedAt;
      byId.set(entry.videoId, {
        videoId: entry.videoId,
        status,
        categoryOverride: entry.categoryOverride ?? existing.categoryOverride,
        updatedAt,
      });
    };

    for (const r of remote) {
      const contentIds = expandLegacyId(r.video_id, LEGACY_MAP);
      // Unknown id → keep the row as-is (1:1).
      const targets = contentIds.length > 0 ? contentIds : [r.video_id];
      for (const videoId of targets) {
        add({
          videoId,
          status: r.status,
          categoryOverride: r.category_override ?? undefined,
          updatedAt: r.updated_at,
        });
      }
    }

    return [...byId.values()];
  }

  const openConflictSheet = useCallback((local: LocalProgressStore, remote: RemoteProgressRow[]) => {
    setLocalWatchedCount(Object.values(local.entries).filter((entry) => entry.status === "watched").length);
    // Expand remote rows to content.ids before counting so split parents count
    // as N (not 1) — matches what the user would see after resolution.
    setRemoteWatchedCount(remoteToEntries(remote).filter((e) => e.status === "watched").length);
    pendingRemoteRef.current = remote;
    pendingLocalRef.current = local;
    setConflictOpen(true);
  }, []);

  const loadSyncedLocalProgress = useCallback((userId: string, devId: string) => {
    let local = loadLocalProgress(userId, devId);

    if (!local) {
      local = migrateFromV1(userId, devId) ?? createEmptyStore(userId, devId);
    }

    // Order: load/migrateV1 → migrateLegacyEntries (sets marker) →
    // syncLegacyKeysToStore (legacy-aware) → save.
    local = migrateLegacyEntries(local, LEGACY_MAP);
    local = syncLegacyKeysToStore(local, LEGACY_MAP);
    saveLocalProgress(local);
    return local;
  }, []);

  // ── Auto-resolve ─────────────────────────────────────────────────────────

  const applyResolution = useCallback(async (
    mode: ConflictPolicyMode,
    userId: string,
    devId: string,
    local: LocalProgressStore,
    remote: RemoteProgressRow[],
  ) => {
    const supabase = getSupabaseBrowserClient();

    if (mode === "local") {
      await fencedUpload(local, supabase, userId, devId, Object.values(local.entries));
    } else if (mode === "remote") {
      const entries = remoteToEntries(remote);
      const updated = { ...local, entries: Object.fromEntries(entries.map((e) => [e.videoId, e])) };
      saveLocalProgress(updated);
      writeLegacyKeys(entries);
      dispatchSyncEvent();
    } else {
      // "latest" — last-write-wins merge
      const merged = mergeLatest(local, remoteToEntries(remote));
      saveLocalProgress(merged);
      await fencedUpload(merged, supabase, userId, devId, Object.values(merged.entries));
      writeLegacyKeys(Object.values(merged.entries));
      dispatchSyncEvent();
    }
  }, []);

  const validateProgressSync = useCallback(async (userId: string, devId: string) => {
    const supabase = getSupabaseBrowserClient();

    try {
      await upsertDevice(supabase, userId, devId, getDeviceLabel());

      const local = loadSyncedLocalProgress(userId, devId);
      const remote = await downloadProgress(supabase, userId, devId);

      if (remote.length > 0) {
        if (hasConflict(local, remoteToEntries(remote))) {
          const policy = loadConflictPolicy(userId);
          if (policy.mode === "ask") {
            openConflictSheet(local, remote);
          } else {
            await applyResolution(policy.mode, userId, devId, local, remote);
          }
        }
      } else {
        const allRemote = await fetchAllDevicesProgress(supabase, userId);

        if (allRemote.length > 0 && hasConflict(local, remoteToEntries(allRemote))) {
          const policy = loadConflictPolicy(userId);
          if (policy.mode === "ask") {
            openConflictSheet(local, allRemote);
          } else {
            await applyResolution(policy.mode, userId, devId, local, allRemote);
          }
        }
      }
    } catch (err) {
      console.error("Progress validation error:", err);
    } finally {
      await doRefreshDevices(userId);
    }
  }, [applyResolution, doRefreshDevices, loadSyncedLocalProgress, openConflictSheet]);

  // ── Conflict sheet confirm ────────────────────────────────────────────────

  async function handleConflictConfirm() {
    if (!user) return;
    const devId = deviceIdRef.current;
    const local = pendingLocalRef.current ?? createEmptyStore(user.id, devId);

    if (dontAskAgain) {
      saveConflictPolicy(user.id, { mode: conflictResolution, updatedAt: "" });
    }

    setConflictOpen(false);
    await applyResolution(conflictResolution, user.id, devId, local, pendingRemoteRef.current);
    pendingRemoteRef.current = [];
    pendingLocalRef.current = null;
  }

  // ── Main sync ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading || !user) {
      if (!user) { syncedSessionRef.current = null; setDevices([]); }
      return;
    }

    const supabase = getSupabaseBrowserClient();

    const runSync = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (autoSync && syncedSessionRef.current === session.access_token) return;
      if (autoSync) syncedSessionRef.current = session.access_token;

      const userId = session.user.id;
      const devId = deviceIdRef.current || getDeviceId();

      if (!autoSync) {
        await validateProgressSync(userId, devId);

        return;
      }

      setSyncing(true);

      try {
        await upsertDevice(supabase, userId, devId, getDeviceLabel());

        // Load or migrate local store, then sync legacy keys in case user
        // marked videos since last sync (PlaylistView writes only to legacy keys)
        const local = loadSyncedLocalProgress(userId, devId);

        const remote = await downloadProgress(supabase, userId, devId);
        const localCount = Object.keys(local.entries).length;

        if (remote.length === 0) {
          // This device has no remote data yet — check if OTHER devices have data
          const allRemote = await fetchAllDevicesProgress(supabase, userId);

          if (allRemote.length === 0) {
            // No data anywhere — upload local
            await fencedUpload(local, supabase, userId, devId, Object.values(local.entries));
          } else if (localCount === 0) {
            // Fresh device — silently adopt merged data from other devices
            const entries = remoteToEntries(allRemote);
            const updated = { ...local, entries: Object.fromEntries(entries.map((e) => [e.videoId, e])) };
            saveLocalProgress(updated);
            await fencedUpload(updated, supabase, userId, devId, entries);
            writeLegacyKeys(entries);
            dispatchSyncEvent();
          } else {
            // Local has data, other devices also have data — check conflict
            const policy = loadConflictPolicy(userId);
            if (!hasConflict(local, remoteToEntries(allRemote))) {
              await fencedUpload(local, supabase, userId, devId, Object.values(local.entries));
            } else if (policy.mode === "ask") {
              openConflictSheet(local, allRemote);
            } else {
              await applyResolution(policy.mode, userId, devId, local, allRemote);
            }
          }
        } else if (hasConflict(local, remoteToEntries(remote))) {
          // Same device has diverged local vs remote
          const policy = loadConflictPolicy(userId);
          if (policy.mode === "ask") {
            openConflictSheet(local, remote);
          } else {
            await applyResolution(policy.mode, userId, devId, local, remote);
          }
        }
        // No conflict — already in sync

        await doRefreshDevices(userId);
      } catch (err) {
        console.error("Progress sync error:", err);
      } finally {
        setSyncing(false);
      }
    };

    runSync();
  }, [
    authLoading,
    user,
    applyResolution,
    doRefreshDevices,
    autoSync,
    loadSyncedLocalProgress,
    openConflictSheet,
    validateProgressSync,
  ]);

  // ── Public actions ────────────────────────────────────────────────────────

  const saveVideoProgress = useCallback(async (
    videoId: string,
    status: ProgressStatus,
    categoryOverride?: CategoryOverrideValue | "auto",
  ) => {
    if (!user) return;

    try {
      const userId = user.id;
      const devId = deviceIdRef.current || getDeviceId();
      const now = new Date().toISOString();
      const raw0 = loadLocalProgress(userId, devId) ?? createEmptyStore(userId, devId);
      // Ensure the store is migrated (idempotent) so no write ever persists a
      // marker-less store and fencedUpload never silently drops the upload.
      const raw = migrateLegacyEntries(raw0, LEGACY_MAP);
      const existing = raw.entries[videoId];
      const nextCategoryOverride =
        categoryOverride === "auto"
          ? undefined
          : categoryOverride !== undefined
            ? categoryOverride
            : existing?.categoryOverride;

      const updated: LocalProgressStore = {
        ...raw,
        entries: {
          ...raw.entries,
          [videoId]: {
            videoId,
            status,
            categoryOverride: nextCategoryOverride,
            updatedAt: now,
          },
        },
      };

      saveLocalProgress(updated);
      writeLegacyKeys(Object.values(updated.entries));
      dispatchSyncEvent();

      if (uploadDebounceRef.current) clearTimeout(uploadDebounceRef.current);
      if (!autoSync) return;
      
      uploadDebounceRef.current = setTimeout(async () => {
        uploadDebounceRef.current = null;
        const latest = loadLocalProgress(userId, devId);
        if (!latest) return;

        try {
          const supabase = getSupabaseBrowserClient();
          // Fence: if this store has not been migrated yet, skip — the next
          // loadSyncedLocalProgress will migrate it and upload then.
          await fencedUpload(latest, supabase, userId, devId, Object.values(latest.entries));
        } catch (err) {
          console.error("Progress upload error:", err);
        }
      }, 500);
    } catch (err) {
      console.error("Progress save error:", err);
    }
  }, [user, autoSync]);

  useEffect(() => {
    if (!user) return;
    const currentUser = user;
    let lastPullAt = 0;

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      if (visibilitySyncingRef.current) return;

      const now = Date.now();
      if (now - lastPullAt < 15_000) return;
      lastPullAt = now;
      visibilitySyncingRef.current = true;

      void (async () => {
        const userId = currentUser.id;
        const devId = deviceIdRef.current || getDeviceId();

        try {
          if (!autoSync) {
            await validateProgressSync(userId, devId);
            return;
          }

          const supabase = getSupabaseBrowserClient();
          const allRemote = await fetchAllDevicesProgress(supabase, userId);
          const raw = loadLocalProgress(userId, devId) ?? createEmptyStore(userId, devId);
          const migrated = migrateLegacyEntries(raw, LEGACY_MAP);
          const local = syncLegacyKeysToStore(migrated, LEGACY_MAP);
          const merged = mergeLatest(local, remoteToEntries(allRemote));

          saveLocalProgress(merged);
          await fencedUpload(merged, supabase, userId, devId, Object.values(merged.entries));
          writeLegacyKeys(Object.values(merged.entries));
          dispatchSyncEvent();
        } catch (err) {
          console.error("Visibility progress sync error:", err);
        } finally {
          visibilitySyncingRef.current = false;
        }
      })();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user, autoSync, validateProgressSync]);

  useEffect(() => {
    return () => {
      if (uploadDebounceRef.current) clearTimeout(uploadDebounceRef.current);
    };
  }, []);

  const deleteDevice = useCallback(async (devId: string) => {
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    await deleteDeviceProgress(supabase, user.id, devId);
    await doRefreshDevices(user.id);
  }, [user, doRefreshDevices]);

  const mergeAllDevices = useCallback(async (mode: ProgressMergeMode = "latest"): Promise<boolean> => {
    if (!user) return false;
    const devId = deviceIdRef.current || getDeviceId();
    const supabase = getSupabaseBrowserClient();
    setSyncing(true);
    try {
      const allRemote = await fetchAllDevicesProgress(supabase, user.id);
      const raw = loadLocalProgress(user.id, devId) ?? createEmptyStore(user.id, devId);
      const migrated = migrateLegacyEntries(raw, LEGACY_MAP);
      const local = syncLegacyKeysToStore(migrated, LEGACY_MAP);
      const beforeSet = new Set(Object.values(local.entries).map((e) => `${e.videoId}:${e.status}`));

      let finalEntries: ProgressEntry[];

      if (mode === "local") {
        const now = new Date().toISOString();
        finalEntries = Object.values(local.entries).map((entry) => ({ ...entry, updatedAt: now }));
        const updated = {
          ...local,
          entries: Object.fromEntries(finalEntries.map((entry) => [entry.videoId, entry])),
        };
        await deleteAllProgress(supabase, user.id);
        saveLocalProgress(updated);
        await fencedUpload(updated, supabase, user.id, devId, finalEntries);
        writeLegacyKeys(finalEntries);
      } else if (mode === "remote") {
        finalEntries = remoteToEntries(allRemote);
        const updated = {
          ...local,
          entries: Object.fromEntries(finalEntries.map((entry) => [entry.videoId, entry])),
        };
        saveLocalProgress(updated);
        await fencedUpload(updated, supabase, user.id, devId, finalEntries);
        writeLegacyKeys(finalEntries);
      } else {
        const merged = mergeLatest(local, remoteToEntries(allRemote));
        finalEntries = Object.values(merged.entries);
        saveLocalProgress(merged);
        await fencedUpload(merged, supabase, user.id, devId, finalEntries);
        writeLegacyKeys(finalEntries);
      }

      dispatchSyncEvent();

      const afterSet = new Set(finalEntries.map((e) => `${e.videoId}:${e.status}`));
      return beforeSet.size !== afterSet.size || [...beforeSet].some((k) => !afterSet.has(k));
    } finally {
      setSyncing(false);
    }
  }, [user]);

  const adoptDeviceProgress = useCallback(async (sourceDeviceId: string) => {
    if (!user) return;
    const devId = deviceIdRef.current || getDeviceId();
    const supabase = getSupabaseBrowserClient();
    setSyncing(true);
    try {
      let entries: ProgressEntry[];
      if (sourceDeviceId === devId) {
        const raw = loadLocalProgress(user.id, devId) ?? createEmptyStore(user.id, devId);
        const migrated = migrateLegacyEntries(raw, LEGACY_MAP);
        entries = Object.values(syncLegacyKeysToStore(migrated, LEGACY_MAP).entries);
      } else {
        // remoteToEntries expands any legacy ids to content.ids before adopt.
        entries = remoteToEntries(await downloadProgress(supabase, user.id, sourceDeviceId));
      }

      if (entries.length === 0) throw new Error("source device has no progress records");

      // Refresh device list right before deletion to avoid leaving orphaned rows
      const freshDevices = await fetchDevices(supabase, user.id);
      const knownIds = new Set([...freshDevices.map((d) => d.device_id), devId]);

      await deleteAllProgress(supabase, user.id);

      const raw = loadLocalProgress(user.id, devId) ?? createEmptyStore(user.id, devId);
      const updated = {
        ...migrateLegacyEntries(raw, LEGACY_MAP),
        entries: Object.fromEntries(entries.map((e) => [e.videoId, e])),
      };

      for (const did of knownIds) {
        await fencedUpload(updated, supabase, user.id, did, entries);
      }

      saveLocalProgress(updated);
      writeLegacyKeys(entries);
      dispatchSyncEvent();
    } finally {
      setSyncing(false);
    }
  }, [user]);

  const resetConflictPolicy = useCallback(() => {
    if (!user) return;
    saveConflictPolicy(user.id, { mode: "ask", updatedAt: "" });
  }, [user]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ProgressSyncContext.Provider value={{
      devices,
      devicesLoading,
      currentDeviceId: deviceIdRef.current,
      syncing,
      deleteDevice,
      mergeAllDevices,
      adoptDeviceProgress,
      saveVideoProgress,
      resetConflictPolicy,
      refreshDevices,
    }}>
      {children}

      {/* 진행상태 충돌 해결 BottomSheet */}
      <BottomSheetRoot
        open={conflictOpen}
        onOpenChange={setConflictOpen}
        dismissible={false}
      >
        <BottomSheetContent
          title="기기마다 시청 기록이 달라요"
          description="어떤 기록으로 맞출지 골라요."
          showCloseButton={false}
          aria-describedby={undefined}
          style={{ paddingBottom: "var(--seed-safe-area-bottom)" }}
        >
          <BottomSheetBody>
            <VStack gap="x4">
              <RadioSelectBoxRoot
                aria-label="충돌 해결 방식"
                value={conflictResolution}
                onValueChange={(v) => setConflictResolution(v as ConflictPolicyMode)}
              >
                {conflictResolutionOptions.map((option) => (
                  <RadioSelectBoxItem
                    key={option.value}
                    value={option.value}
                    label={option.label}
                    description={option.description}
                    suffix={<RadioSelectBoxRadiomark />}
                  />
                ))}
              </RadioSelectBoxRoot>

              <Checkbox
                label="선택 기억하기"
                tone="neutral"
                checked={dontAskAgain}
                onCheckedChange={setDontAskAgain}
              />
            </VStack>
          </BottomSheetBody>
          <BottomSheetFooter>
            <ActionButton
              variant="neutralSolid"
              size="large"
              style={{ width: "100%" }}
              onClick={handleConflictConfirm}
            >
              확인
            </ActionButton>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheetRoot>
    </ProgressSyncContext.Provider>
  );
}
