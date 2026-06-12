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
import {
  commitStore,
  dispatchSyncEvent,
  fencedUpload,
  LEGACY_MAP,
  remoteToEntries,
  writeLegacyKeys,
} from "@/lib/progress-merge";
import { expandLegacyId } from "@/lib/legacy-map";
import { ensureLegacyBackup } from "@/lib/legacy-backup";
import { ensureAnonymousSession } from "@/lib/anon-auth";
import type { CategoryOverrideValue } from "@/lib/storage";
import {
  deleteDeviceProgress,
  downloadProgress,
  deleteAllProgress,
  deleteOtherDevicesProgress,
  fetchAllDevicesProgress,
  fetchDevices,
  upsertDevice,
  type DeviceRow,
  type RemoteProgressRow,
} from "@/lib/supabase-progress";
import { getDeviceLabel } from "@/lib/device-info";
import { pruneRedundantDevices } from "@/lib/device-prune";
import { ProgressConflictSheet } from "@/components/ProgressConflictSheet";

export type ProgressMergeMode = Exclude<ConflictPolicyMode, "ask">;

// PlaylistView 등 기존 사용처 호환을 위한 재노출 — 구현은 progress-merge로 이동.
export { SYNC_EVENT, dispatchSyncEvent } from "@/lib/progress-merge";

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
      await commitStore(updated, supabase, userId, devId, { upload: false });
    } else {
      // "latest" — last-write-wins merge
      const merged = mergeLatest(local, remoteToEntries(remote));
      await commitStore(merged, supabase, userId, devId);
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
            await commitStore(updated, supabase, userId, devId);
          } else {
            // Local has data, other devices also have data — check conflict
            const remoteEntries = remoteToEntries(allRemote);
            const policy = loadConflictPolicy(userId);
            if (!hasConflict(local, remoteEntries)) {
              // 진짜 충돌(같은 id의 status 불일치) 없음 — 어느 쪽도 버리지 않는
              // 합집합 병합 후 업로드. 프롬프트 없이 조용히 양방향 동기화.
              const merged = mergeLatest(local, remoteEntries);
              await commitStore(merged, supabase, userId, devId);
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
            await commitStore(merged, supabase, userId, devId);
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
          await commitStore(merged, supabase, userId, devId);
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
        const uploaded = await commitStore(updated, supabase, user.id, devId);
        if (uploaded) await deleteOtherDevicesProgress(supabase, user.id, devId);
      } else if (mode === "remote") {
        finalEntries = remoteToEntries(allRemote);
        const updated = {
          ...local,
          entries: Object.fromEntries(finalEntries.map((entry) => [entry.videoId, entry])),
        };
        await commitStore(updated, supabase, user.id, devId);
      } else {
        const merged = mergeLatest(local, remoteToEntries(allRemote));
        finalEntries = Object.values(merged.entries);
        await commitStore(merged, supabase, user.id, devId);
      }

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

      await commitStore(updated, supabase, user.id, devId, { upload: false });
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

      <ProgressConflictSheet
        open={conflictOpen}
        onOpenChange={setConflictOpen}
        localWatchedCount={localWatchedCount}
        remoteWatchedCount={remoteWatchedCount}
        resolution={conflictResolution}
        onResolutionChange={setConflictResolution}
        dontAskAgain={dontAskAgain}
        onDontAskAgainChange={setDontAskAgain}
        onConfirm={handleConflictConfirm}
      />
    </ProgressSyncContext.Provider>
  );
}
