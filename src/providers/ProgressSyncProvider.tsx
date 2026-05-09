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
import { getSupabaseBrowserClient } from "@/lib/supabase";
import {
  createEmptyStore,
  getDeviceId,
  hasConflict,
  loadConflictPolicy,
  loadLocalProgress,
  mergeLatest,
  migrateFromV1,
  saveConflictPolicy,
  saveLocalProgress,
  syncLegacyKeysToStore,
  type ConflictPolicyMode,
  type LocalProgressStore,
  type ProgressEntry,
} from "@/lib/progress-sync";
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
  Divider,
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

// Custom DOM event dispatched after writing to legacy localStorage keys
export const SYNC_EVENT = "llt-progress-sync";
export function dispatchSyncEvent() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

// ── Context ──────────────────────────────────────────────────────────────────

interface ProgressSyncContextType {
  devices: DeviceRow[];
  devicesLoading: boolean;
  currentDeviceId: string;
  syncing: boolean;
  deleteDevice: (deviceId: string) => Promise<void>;
  mergeAllDevices: (mode?: ProgressMergeMode) => Promise<void>;
  adoptDeviceProgress: (sourceDeviceId: string) => Promise<void>;
  resetConflictPolicy: () => void;
  refreshDevices: () => Promise<void>;
}

const ProgressSyncContext = createContext<ProgressSyncContextType>({
  devices: [],
  devicesLoading: false,
  currentDeviceId: "",
  syncing: false,
  deleteDevice: async () => {},
  mergeAllDevices: async () => {},
  adoptDeviceProgress: async () => {},
  resetConflictPolicy: () => {},
  refreshDevices: async () => {},
});

export function useProgressSync() {
  return useContext(ProgressSyncContext);
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function ProgressSyncProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
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
  const conflictResolutionOptions: { value: ConflictPolicyMode; label: string; description: string }[] = [
    { value: "local", label: `현재 기기 기록 사용 (${localWatchedCount}개 시청)`, description: "다른 기기도 현재 기기 기록으로 맞춰요." },
    { value: "remote", label: `클라우드 기록 사용 (${remoteWatchedCount}개 시청)`, description: "현재 기기 기록을 클라우드 기록으로 맞춰요." },
    { value: "latest", label: "자동으로 합치기", description: "영상마다 더 최근에 본 기록을 선택해요. (권장)" },
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

  function remoteToEntries(remote: RemoteProgressRow[]): ProgressEntry[] {
    return remote.map((r) => ({
      videoId: r.video_id,
      status: r.status,
      categoryOverride: r.category_override ?? undefined,
      updatedAt: r.updated_at,
    }));
  }

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
      await uploadProgress(supabase, userId, devId, Object.values(local.entries));
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
      await uploadProgress(supabase, userId, devId, Object.values(merged.entries));
      writeLegacyKeys(Object.values(merged.entries));
      dispatchSyncEvent();
    }
  }, []);

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
      // Deduplicate by access token
      if (syncedSessionRef.current === session.access_token) return;
      syncedSessionRef.current = session.access_token;

      const userId = session.user.id;
      const devId = deviceIdRef.current || getDeviceId();
      setSyncing(true);

      try {
        await upsertDevice(supabase, userId, devId, getDeviceLabel());

        // Load or migrate local store, then sync legacy keys in case user
        // marked videos since last sync (PlaylistView writes only to legacy keys)
        let local = loadLocalProgress(userId, devId);
        if (!local) {
          local = migrateFromV1(userId, devId) ?? createEmptyStore(userId, devId);
          saveLocalProgress(local);
        }
        local = syncLegacyKeysToStore(local);

        const remote = await downloadProgress(supabase, userId, devId);
        const localCount = Object.keys(local.entries).length;

        if (remote.length === 0) {
          // This device has no remote data yet — check if OTHER devices have data
          const allRemote = await fetchAllDevicesProgress(supabase, userId);

          if (allRemote.length === 0) {
            // No data anywhere — upload local
            await uploadProgress(supabase, userId, devId, Object.values(local.entries));
          } else if (localCount === 0) {
            // Fresh device — silently adopt merged data from other devices
            const entries = remoteToEntries(allRemote);
            const updated = { ...local, entries: Object.fromEntries(entries.map((e) => [e.videoId, e])) };
            saveLocalProgress(updated);
            await uploadProgress(supabase, userId, devId, entries);
            writeLegacyKeys(entries);
            dispatchSyncEvent();
          } else {
            // Local has data, other devices also have data — check conflict
            const policy = loadConflictPolicy(userId);
            if (!hasConflict(local, remoteToEntries(allRemote))) {
              await uploadProgress(supabase, userId, devId, Object.values(local.entries));
            } else if (policy.mode === "ask") {
              setLocalWatchedCount(Object.values(local.entries).filter((e) => e.status === "watched").length);
              setRemoteWatchedCount(allRemote.filter((r) => r.status === "watched").length);
              pendingRemoteRef.current = allRemote;
              pendingLocalRef.current = local;
              setConflictOpen(true);
            } else {
              await applyResolution(policy.mode, userId, devId, local, allRemote);
            }
          }
        } else if (hasConflict(local, remoteToEntries(remote))) {
          // Same device has diverged local vs remote
          const policy = loadConflictPolicy(userId);
          if (policy.mode === "ask") {
            setLocalWatchedCount(Object.values(local.entries).filter((e) => e.status === "watched").length);
            setRemoteWatchedCount(remote.filter((r) => r.status === "watched").length);
            pendingRemoteRef.current = remote;
            pendingLocalRef.current = local;
            setConflictOpen(true);
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
  }, [authLoading, user, applyResolution, doRefreshDevices]);

  // ── Public actions ────────────────────────────────────────────────────────

  const deleteDevice = useCallback(async (devId: string) => {
    if (!user) return;
    const supabase = getSupabaseBrowserClient();
    await deleteDeviceProgress(supabase, user.id, devId);
    await doRefreshDevices(user.id);
  }, [user, doRefreshDevices]);

  const mergeAllDevices = useCallback(async (mode: ProgressMergeMode = "latest") => {
    if (!user) return;
    const devId = deviceIdRef.current || getDeviceId();
    const supabase = getSupabaseBrowserClient();
    setSyncing(true);
    try {
      const allRemote = await fetchAllDevicesProgress(supabase, user.id);
      const raw = loadLocalProgress(user.id, devId) ?? createEmptyStore(user.id, devId);
      const local = syncLegacyKeysToStore(raw);

      if (mode === "local") {
        const now = new Date().toISOString();
        const entries = Object.values(local.entries).map((entry) => ({
          ...entry,
          updatedAt: now,
        }));
        const updated = {
          ...local,
          entries: Object.fromEntries(entries.map((entry) => [entry.videoId, entry])),
        };

        await deleteAllProgress(supabase, user.id);
        saveLocalProgress(updated);
        await uploadProgress(supabase, user.id, devId, entries);
        writeLegacyKeys(entries);
      } else if (mode === "remote") {
        const entries = remoteToEntries(allRemote);
        const updated = {
          ...local,
          entries: Object.fromEntries(entries.map((entry) => [entry.videoId, entry])),
        };

        saveLocalProgress(updated);
        await uploadProgress(supabase, user.id, devId, entries);
        writeLegacyKeys(entries);
      } else {
        const merged = mergeLatest(local, remoteToEntries(allRemote));
        saveLocalProgress(merged);
        await uploadProgress(supabase, user.id, devId, Object.values(merged.entries));
        writeLegacyKeys(Object.values(merged.entries));
      }

      dispatchSyncEvent();
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
        entries = Object.values(syncLegacyKeysToStore(raw).entries);
      } else {
        entries = remoteToEntries(await downloadProgress(supabase, user.id, sourceDeviceId));
      }

      if (entries.length === 0) throw new Error("source device has no progress records");

      // Refresh device list right before deletion to avoid leaving orphaned rows
      const freshDevices = await fetchDevices(supabase, user.id);
      const knownIds = new Set([...freshDevices.map((d) => d.device_id), devId]);

      await deleteAllProgress(supabase, user.id);

      for (const did of knownIds) {
        await uploadProgress(supabase, user.id, did, entries);
      }

      const raw = loadLocalProgress(user.id, devId) ?? createEmptyStore(user.id, devId);
      const updated = { ...raw, entries: Object.fromEntries(entries.map((e) => [e.videoId, e])) };
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
          title="기기 간 시청 기록이 달라요"
          description="어떤 기록으로 맞출지 골라요."
          showCloseButton={false}
          aria-describedby={undefined}
          style={{ paddingBottom: "var(--seed-safe-area-bottom)" }}
        >
          <BottomSheetBody>
            <VStack gap="x2">
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

              <Divider />

              <Checkbox
                label="앞으로 자동으로 처리하기"
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
