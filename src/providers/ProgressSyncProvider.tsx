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
  needsReconcile,
  saveLocalProgress,
  syncLegacyKeysToStore,
  type ConflictPolicyMode,
  type LocalProgressStore,
  type ProgressEntry,
  type ProgressStatus,
} from "@/lib/progress-sync";
import { buildLegacyMap, expandLegacyId } from "@/lib/legacy-map";
import { ensureLegacyBackup } from "@/lib/legacy-backup";
import { ensureAnonymousSession } from "@/lib/anon-auth";
import type { PlaylistData } from "@/types";
import playlistInitial from "../../data/playlist.initial.json";
import type { CategoryOverrideValue } from "@/lib/storage";
import {
  deleteDeviceProgress,
  downloadProgress,
  deleteAllProgress,
  deleteOtherDevicesProgress,
  fetchAllDevicesProgress,
  fetchDevices,
  uploadProgress,
  upsertDevice,
  type DeviceRow,
  type RemoteProgressRow,
} from "@/lib/supabase-progress";
import { getDeviceLabel } from "@/lib/device-info";
import { pruneRedundantDevices } from "@/lib/device-prune";
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
//
// Returns whether the upload actually ran. 호출부에서 '업로드 확인 후 삭제'
// 같은 파괴적 후속 작업을 게이트하는 데 쓴다 — 펜스로 조용히 건너뛴 업로드를
// 성공으로 착각하고 원격을 지우면 안 된다(하드 제약).
async function fencedUpload(
  store: LocalProgressStore,
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  userId: string,
  devId: string,
  entries: ProgressEntry[],
): Promise<boolean> {
  if (store.migratedSchema !== CURRENT_MIGRATION) return false;
  await uploadProgress(supabase, userId, devId, entries);
  return true;
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
  /**
   * 비로그인 유저의 새 시청 기록을 Supabase(content.id 방식)로도 저장하기 위한
   * 진입점. localStorage 저장이 끝난 '뒤에' 호출해야 한다 — 익명 세션 생성이
   * 실패해도 기록은 이미 로컬에 안전하다(legacy 폴백). 성공하면
   * onAuthStateChange → 메인 동기화가 레거시 키를 흡수해 업로드한다.
   */
  requestAnonymousSync: () => void;
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
  requestAnonymousSync: () => {},
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

  // 미러 재작성은 비파괴여야 한다(하드 제약): 카탈로그가 모르는(unknown) id가
  // 기존 레거시 키에 있으면 — 카탈로그에서 삭제됐거나 아주 오래된 데이터 —
  // entries에 없어도 버리지 않고 그대로 보존한다. 원본은 ensureLegacyBackup이
  // 이미 떠 둔 상태지만, 미러 자체도 잃지 않는 편이 안전하다.
  function writeLegacyKeys(entries: ProgressEntry[]) {
    ensureLegacyBackup();
    const watchedIds = entries.filter((e) => e.status === "watched").map((e) => e.videoId);
    const overrides: Record<string, string | null> = {};
    for (const e of entries) {
      if (e.categoryOverride !== undefined) overrides[e.videoId] = e.categoryOverride ?? null;
    }
    try {
      const watchedSet = new Set(watchedIds);
      const prevWatched: string[] = JSON.parse(localStorage.getItem("llt-watched") ?? "[]");
      for (const id of prevWatched) {
        if (expandLegacyId(id, LEGACY_MAP).length === 0 && !watchedSet.has(id)) {
          watchedIds.push(id);
        }
      }
      const prevOverrides: Record<string, string | null> = JSON.parse(
        localStorage.getItem("llt-overrides") ?? "{}",
      );
      for (const [id, value] of Object.entries(prevOverrides)) {
        if (expandLegacyId(id, LEGACY_MAP).length === 0 && !(id in overrides)) {
          overrides[id] = value;
        }
      }
    } catch {
      // 기존 키가 손상돼 파싱이 안 되면 보존할 수 없지만, 원본은 백업에 남아 있다.
    }
    localStorage.setItem("llt-watched", JSON.stringify(watchedIds));
    localStorage.setItem("llt-overrides", JSON.stringify(overrides));
  }

  // Legacy-AWARE remote ingestion choke point (§4.5). Each remote row's
  // video_id is expanded through expandLegacyId: a legacy split id emits one
  // entry per content.id (carrying the row's status/override/updated_at).
  // Two rows resolving to the same content.id (frozen legacy parent row +
  // post-migration content.id row) are settled by LAST-WRITE-WINS, with
  // watched preferred on an exact timestamp tie (migration-time safety).
  // NOT watched-union: a frozen legacy "watched" row would otherwise override
  // a newer deliberate un-watch forever (resurrect + pseudo-conflict loop).
  // Unknown ids are kept 1:1 so nothing is dropped.
  function remoteToEntries(remote: RemoteProgressRow[]): ProgressEntry[] {
    const byId = new Map<string, ProgressEntry>();

    const add = (entry: ProgressEntry) => {
      const existing = byId.get(entry.videoId);
      if (!existing) {
        byId.set(entry.videoId, entry);
        return;
      }
      let winner: ProgressEntry;
      let loser: ProgressEntry;
      if (existing.updatedAt === entry.updatedAt) {
        // tie → watched 쪽 보존(하드 제약: 의심스러우면 시청 기록 유지)
        winner = existing.status === "watched" ? existing : entry;
        loser = winner === existing ? entry : existing;
      } else if (existing.updatedAt > entry.updatedAt) {
        winner = existing;
        loser = entry;
      } else {
        winner = entry;
        loser = existing;
      }
      byId.set(entry.videoId, {
        videoId: entry.videoId,
        status: winner.status,
        categoryOverride: winner.categoryOverride ?? loser.categoryOverride,
        updatedAt: winner.updatedAt,
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
    // 마이그레이션/미러 재작성이 일어나기 전에 레거시 원본을 불변 백업해 둔다.
    ensureLegacyBackup();

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
            const remoteEntries = remoteToEntries(allRemote);
            const policy = loadConflictPolicy(userId);
            if (!hasConflict(local, remoteEntries)) {
              // 진짜 충돌(같은 id의 status 불일치) 없음 — 어느 쪽도 버리지 않는
              // 합집합 병합 후 업로드. 프롬프트 없이 조용히 양방향 동기화.
              const merged = mergeLatest(local, remoteEntries);
              saveLocalProgress(merged);
              await fencedUpload(merged, supabase, userId, devId, Object.values(merged.entries));
              writeLegacyKeys(Object.values(merged.entries));
              dispatchSyncEvent();
            } else if (policy.mode === "ask") {
              openConflictSheet(local, allRemote);
            } else {
              await applyResolution(policy.mode, userId, devId, local, allRemote);
            }
          }
        } else {
          const remoteEntries = remoteToEntries(remote);
          if (hasConflict(local, remoteEntries)) {
            // Same device has diverged local vs remote (status mismatch)
            const policy = loadConflictPolicy(userId);
            if (policy.mode === "ask") {
              openConflictSheet(local, remote);
            } else {
              await applyResolution(policy.mode, userId, devId, local, remote);
            }
          } else if (needsReconcile(local, remoteEntries)) {
            // 불일치는 아니지만 양쪽 집합이 다름(예: 업로드 누락분) — 조용히 병합.
            const merged = mergeLatest(local, remoteEntries);
            saveLocalProgress(merged);
            await fencedUpload(merged, supabase, userId, devId, Object.values(merged.entries));
            writeLegacyKeys(Object.values(merged.entries));
            dispatchSyncEvent();
          }
        }

        // 동기화가 끝난 뒤에만 정리: 오래 미접속이고 기록이 현재 기기 원격
        // 기록으로 완전히 커버되는 유령 기기를 삭제한다. 고유 데이터가 있는
        // 기기는 isRowCovered가 걸러 보존하므로 실패해도 데이터 유실은 없다.
        try {
          await pruneRedundantDevices(
            supabase, userId, devId, remoteToEntries,
            (id) => expandLegacyId(id, LEGACY_MAP),
          );
        } catch (err) {
          console.error("Device prune error:", err);
        }

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
          const remoteEntries = remoteToEntries(allRemote);

          // 달라진 게 없으면 업로드/미러 재작성/이벤트를 생략 — 포커스 복귀마다
          // 전체 upsert가 나가 공유 DB에 불필요한 쓰기 트래픽을 만들지 않도록.
          if (!needsReconcile(local, remoteEntries)) {
            saveLocalProgress(local);
            return;
          }

          const merged = mergeLatest(local, remoteEntries);
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
        // 순서가 중요: 업로드가 '실제로 실행되고 성공한 뒤'에만 다른 기기 행을
        // 지운다. (예전: 전체 삭제 → 업로드. 업로드가 실패하면 원격이 통째로
        // 사라졌다.) 펜스로 업로드가 건너뛰어진 경우에도 삭제하지 않는다.
        saveLocalProgress(updated);
        const uploaded = await fencedUpload(updated, supabase, user.id, devId, finalEntries);
        if (uploaded) await deleteOtherDevicesProgress(supabase, user.id, devId);
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

      const raw = loadLocalProgress(user.id, devId) ?? createEmptyStore(user.id, devId);
      const updated = {
        ...migrateLegacyEntries(raw, LEGACY_MAP),
        entries: Object.fromEntries(entries.map((e) => [e.videoId, e])),
      };

      // 쓰기 가능 여부를 현재 기기 업로드로 먼저 검증한 뒤에 삭제한다.
      // (예전: 전체 삭제 → 업로드. 삭제 직후 업로드가 실패하면 원격 전체 유실.)
      // 펜스로 업로드가 건너뛰어졌다면 삭제 자체를 중단한다(하드 제약).
      const probeUploaded = await fencedUpload(updated, supabase, user.id, devId, entries);
      if (!probeUploaded) {
        throw new Error("adoptDeviceProgress: 업로드 펜스가 닫혀 있어 원격 보호를 위해 중단");
      }
      await deleteAllProgress(supabase, user.id);

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

  const requestAnonymousSync = useCallback(() => {
    if (user) return; // 이미 세션이 있으면 일반 경로(saveVideoProgress)가 처리
    ensureLegacyBackup(); // 익명 동기화가 레거시 키를 만지기 전에 원본 보존
    void ensureAnonymousSession(getSupabaseBrowserClient());
    // 성공 시 onAuthStateChange가 user를 채우고, 메인 동기화 effect가
    // migrateFromV1/syncLegacyKeysToStore 경로로 현재 로컬 기록을 흡수해
    // content.id 방식으로 업로드한다. 실패 시 아무 일도 안 함(로컬 저장 유지).
    //
    // 익명 → 정식 로그인 전환 시 데이터 경로: 모든 기록은 레거시 키 미러
    // (llt-watched/llt-overrides)에도 항상 남으므로, 나중에 OAuth 로그인하면
    // 회원 uid의 스토어가 migrateFromV1/syncLegacyKeysToStore로 같은 기록을
    // 흡수해 회원 계정으로 업로드된다 — 기기에 한정해 데이터가 따라간다.
    // 익명 uid 밑에 남은 원격 행은 고아가 되지만 유실은 아니다(정리는 운영 작업).
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
      requestAnonymousSync,
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
