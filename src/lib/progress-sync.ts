import type { CategoryOverrideValue } from "./storage";

// ── Key constants ────────────────────────────────────────────────────────────

const KEY_DEVICE_ID = "llt-device-id";
const KEY_PROGRESS_V2 = (userId: string, deviceId: string) =>
  `llt-progress-v2-${userId}-${deviceId}`;
const KEY_CONFLICT_POLICY = (userId: string) =>
  `llt-progress-conflict-policy-${userId}`;

// Legacy keys (read-only, used only during migration)
const LEGACY_KEY_WATCHED = "llt-watched";
const LEGACY_KEY_OVERRIDES = "llt-overrides";

// ── Types ────────────────────────────────────────────────────────────────────

export type ProgressStatus = "watched" | "unwatched";

export type ConflictPolicyMode = "local" | "remote" | "latest" | "ask";

export interface ProgressEntry {
  videoId: string;
  status: ProgressStatus;
  categoryOverride?: CategoryOverrideValue;
  updatedAt: string;
}

export interface LocalProgressStore {
  schemaVersion: 2;
  userId: string;
  deviceId: string;
  deviceName?: string;
  updatedAt: string;
  entries: Record<string, ProgressEntry>;
}

export interface ConflictPolicy {
  mode: ConflictPolicyMode;
  updatedAt: string;
}

// ── Device ID ────────────────────────────────────────────────────────────────

export function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(KEY_DEVICE_ID);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY_DEVICE_ID, id);
  }
  return id;
}

// ── Local progress store ─────────────────────────────────────────────────────

export function loadLocalProgress(
  userId: string,
  deviceId: string,
): LocalProgressStore | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY_PROGRESS_V2(userId, deviceId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocalProgressStore;
  } catch {
    return null;
  }
}

export function saveLocalProgress(store: LocalProgressStore): void {
  if (typeof window === "undefined") return;
  store.updatedAt = new Date().toISOString();
  localStorage.setItem(
    KEY_PROGRESS_V2(store.userId, store.deviceId),
    JSON.stringify(store),
  );
}

export function createEmptyStore(
  userId: string,
  deviceId: string,
): LocalProgressStore {
  return {
    schemaVersion: 2,
    userId,
    deviceId,
    updatedAt: new Date().toISOString(),
    entries: {},
  };
}

// ── Migration from v1 (llt-watched / llt-overrides) ─────────────────────────

export function migrateFromV1(
  userId: string,
  deviceId: string,
): LocalProgressStore | null {
  if (typeof window === "undefined") return null;

  const watchedRaw = localStorage.getItem(LEGACY_KEY_WATCHED);
  const overridesRaw = localStorage.getItem(LEGACY_KEY_OVERRIDES);

  if (!watchedRaw && !overridesRaw) return null;

  const watched: string[] = watchedRaw ? JSON.parse(watchedRaw) : [];
  const overrides: Record<string, CategoryOverrideValue> = overridesRaw
    ? JSON.parse(overridesRaw)
    : {};

  // No per-video timestamps in v1 — use epoch so remote always wins on conflict
  const migratedAt = new Date(0).toISOString();

  const entries: Record<string, ProgressEntry> = {};
  const allIds = new Set([...watched, ...Object.keys(overrides)]);

  for (const videoId of allIds) {
    entries[videoId] = {
      videoId,
      status: watched.includes(videoId) ? "watched" : "unwatched",
      categoryOverride: overrides[videoId] ?? undefined,
      updatedAt: migratedAt,
    };
  }

  const store = createEmptyStore(userId, deviceId);
  store.entries = entries;
  return store;
}

// ── Conflict policy ──────────────────────────────────────────────────────────

export function loadConflictPolicy(userId: string): ConflictPolicy {
  if (typeof window === "undefined") return { mode: "ask", updatedAt: "" };
  const raw = localStorage.getItem(KEY_CONFLICT_POLICY(userId));
  if (!raw) return { mode: "ask", updatedAt: "" };
  try {
    return JSON.parse(raw) as ConflictPolicy;
  } catch {
    return { mode: "ask", updatedAt: "" };
  }
}

export function saveConflictPolicy(userId: string, policy: ConflictPolicy): void {
  if (typeof window === "undefined") return;
  policy.updatedAt = new Date().toISOString();
  localStorage.setItem(KEY_CONFLICT_POLICY(userId), JSON.stringify(policy));
}

// ── Sync legacy keys into v2 store ──────────────────────────────────────────

// PlaylistView writes only to legacy keys (llt-watched / llt-overrides) when
// the user marks videos. Call this before any merge to capture those changes.
export function syncLegacyKeysToStore(store: LocalProgressStore): LocalProgressStore {
  if (typeof window === "undefined") return store;
  const watchedRaw = localStorage.getItem("llt-watched");
  const overridesRaw = localStorage.getItem("llt-overrides");
  if (!watchedRaw && !overridesRaw) return store;

  const watched: string[] = watchedRaw ? JSON.parse(watchedRaw) : [];
  const overrides: Record<string, string | null> = overridesRaw ? JSON.parse(overridesRaw) : {};
  const now = new Date().toISOString();

  const updated = { ...store, entries: { ...store.entries } };
  const allIds = new Set([...watched, ...Object.keys(overrides)]);

  for (const videoId of allIds) {
    const legacyStatus: ProgressStatus = watched.includes(videoId) ? "watched" : "unwatched";
    const existing = updated.entries[videoId];
    if (!existing || existing.status !== legacyStatus) {
      updated.entries[videoId] = {
        videoId,
        status: legacyStatus,
        categoryOverride: overrides[videoId] !== undefined
          ? (overrides[videoId] as CategoryOverrideValue ?? undefined)
          : existing?.categoryOverride,
        updatedAt: now,
      };
    }
  }

  const watchedSet = new Set(watched);
  for (const videoId of Object.keys(store.entries)) {
    if (store.entries[videoId].status === "watched" && !watchedSet.has(videoId)) {
      updated.entries[videoId] = {
        ...store.entries[videoId],
        status: "unwatched",
        updatedAt: now,
      };
    }
  }

  return updated;
}

// ── Merge helpers ────────────────────────────────────────────────────────────

export type RemoteEntry = {
  videoId: string;
  status: ProgressStatus;
  categoryOverride?: CategoryOverrideValue;
  updatedAt: string;
};

export function mergeLatest(
  local: LocalProgressStore,
  remote: RemoteEntry[],
): LocalProgressStore {
  const merged = { ...local, entries: { ...local.entries } };

  for (const remoteEntry of remote) {
    const localEntry = merged.entries[remoteEntry.videoId];
    if (!localEntry || remoteEntry.updatedAt > localEntry.updatedAt) {
      merged.entries[remoteEntry.videoId] = {
        videoId: remoteEntry.videoId,
        status: remoteEntry.status,
        categoryOverride: remoteEntry.categoryOverride,
        updatedAt: remoteEntry.updatedAt,
      };
    }
  }

  return merged;
}

export function hasConflict(
  local: LocalProgressStore,
  remote: RemoteEntry[],
): boolean {
  for (const remoteEntry of remote) {
    const localEntry = local.entries[remoteEntry.videoId];
    if (!localEntry) continue;
    if (localEntry.status !== remoteEntry.status) return true;
  }
  // Check if local has entries remote doesn't (and vice versa count differs)
  return (
    Object.keys(local.entries).length !== remote.length ||
    remote.some((r) => !local.entries[r.videoId])
  );
}
