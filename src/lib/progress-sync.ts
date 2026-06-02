import type { CategoryOverrideValue } from "./storage";
import { expandLegacyId, isContentId, type LegacyMap } from "./legacy-map";

// Bump when the legacy→content.id migration semantics change.
export const CURRENT_MIGRATION = 1;

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
  /** Set to CURRENT_MIGRATION once legacy ids have been converted to content.id. */
  migratedSchema?: number;
  entries: Record<string, ProgressEntry>;
}

export interface ConflictPolicy {
  mode: ConflictPolicyMode;
  updatedAt: string;
}

// ── Device ID ────────────────────────────────────────────────────────────────

function createDeviceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join(""),
    ].join("-");
  }

  return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(KEY_DEVICE_ID);
  if (!id) {
    id = createDeviceId();
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
    // Brand-new / clean devices have nothing legacy to migrate, so the marker is
    // set immediately and the upload fence opens on the same pass.
    migratedSchema: CURRENT_MIGRATION,
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
  // createEmptyStore stamps migratedSchema=CURRENT_MIGRATION, but this store
  // contains raw legacy ids (incl. split parents) that still need expansion.
  // Clear the marker so migrateLegacyEntries runs and expands them.
  store.migratedSchema = undefined;
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
//
// Legacy-AWARE: each id read from the legacy keys is resolved through
// `expandLegacyId(id, legacyMap)` to its content.id(s) BEFORE comparing/ingesting.
// A legacy split id therefore resolves to all its content.ids; if those already
// match the store's status (e.g. set by migrateLegacyEntries) nothing is
// re-stamped (no now() leak). A genuine new content.id mark resolves to itself
// and is ingested with now() (a real change). Unknown ids (expand → []) are
// skipped — not dropped from the store, just not ingested.
export function syncLegacyKeysToStore(
  store: LocalProgressStore,
  legacyMap: LegacyMap,
): LocalProgressStore {
  if (typeof window === "undefined") return store;
  const watchedRaw = localStorage.getItem("llt-watched");
  const overridesRaw = localStorage.getItem("llt-overrides");
  if (!watchedRaw && !overridesRaw) return store;

  const watched: string[] = watchedRaw ? JSON.parse(watchedRaw) : [];
  const overrides: Record<string, string | null> = overridesRaw ? JSON.parse(overridesRaw) : {};
  const now = new Date().toISOString();

  const updated = { ...store, entries: { ...store.entries } };
  const watchedSet = new Set(watched);
  const allIds = new Set([...watched, ...Object.keys(overrides)]);

  // Resolved content.id → effective override (from the first legacy id that
  // carried one). Also tracks which content.ids the legacy keys map to so the
  // demotion pass below only un-watches genuinely-absent content.ids.
  const resolvedWatched = new Set<string>();

  for (const legacyId of allIds) {
    const contentIds = expandLegacyId(legacyId, legacyMap);
    if (contentIds.length === 0) continue; // unknown id — skip (do not drop store entries)

    const legacyStatus: ProgressStatus = watchedSet.has(legacyId) ? "watched" : "unwatched";
    const override =
      overrides[legacyId] !== undefined
        ? (overrides[legacyId] as CategoryOverrideValue ?? undefined)
        : undefined;

    for (const contentId of contentIds) {
      if (legacyStatus === "watched") resolvedWatched.add(contentId);
      const existing = updated.entries[contentId];
      if (!existing || existing.status !== legacyStatus) {
        updated.entries[contentId] = {
          videoId: contentId,
          status: legacyStatus,
          categoryOverride: override !== undefined ? override : existing?.categoryOverride,
          updatedAt: now,
        };
      }
    }
  }

  // Demote content.id entries that are watched in the store but no longer
  // present (as a resolved content.id) in the legacy watched set.
  for (const videoId of Object.keys(store.entries)) {
    if (
      store.entries[videoId].status === "watched" &&
      isContentId(videoId, legacyMap) &&
      !resolvedWatched.has(videoId)
    ) {
      updated.entries[videoId] = {
        ...store.entries[videoId],
        status: "unwatched",
        updatedAt: now,
      };
    }
  }

  return updated;
}

// ── One-time legacy→content.id conversion of the store's own entries ─────────

/**
 * Convert the store's own legacy-only entries to content.id entries, ONCE.
 * Idempotent: a store already at CURRENT_MIGRATION is returned unchanged.
 *
 * - content.id entries are kept as-is.
 * - legacy-only (split parent) entries expand to all N content.ids, each
 *   carrying the ORIGINAL updatedAt (never now(); epoch stays epoch) and the
 *   legacy entry's categoryOverride; the legacy-only entry is then dropped.
 * - Unknown ids are kept as-is (forward-compat, never dropped).
 * - Collision (expansion hits an existing content.id entry): status-union
 *   (watched wins); updatedAt = max(existing, incoming).
 *
 * Pure/deterministic — only reads entry fields; no localStorage/Date access.
 */
export function migrateLegacyEntries(
  store: LocalProgressStore,
  legacyMap: LegacyMap,
): LocalProgressStore {
  if (store.migratedSchema === CURRENT_MIGRATION) return store;

  const entries: Record<string, ProgressEntry> = {};

  const merge = (incoming: ProgressEntry) => {
    const existing = entries[incoming.videoId];
    if (!existing) {
      entries[incoming.videoId] = incoming;
      return;
    }
    const status: ProgressStatus =
      existing.status === "watched" || incoming.status === "watched"
        ? "watched"
        : "unwatched";
    const updatedAt =
      existing.updatedAt >= incoming.updatedAt ? existing.updatedAt : incoming.updatedAt;
    entries[incoming.videoId] = {
      videoId: incoming.videoId,
      status,
      categoryOverride: incoming.categoryOverride ?? existing.categoryOverride,
      updatedAt,
    };
  };

  for (const entry of Object.values(store.entries)) {
    if (isContentId(entry.videoId, legacyMap)) {
      merge({ ...entry });
      continue;
    }
    const contentIds = expandLegacyId(entry.videoId, legacyMap);
    if (contentIds.length === 0) {
      // Unknown id — keep as-is.
      merge({ ...entry });
      continue;
    }
    // Legacy-only split parent — expand, carrying the ORIGINAL timestamp.
    for (const contentId of contentIds) {
      merge({
        videoId: contentId,
        status: entry.status,
        categoryOverride: entry.categoryOverride,
        updatedAt: entry.updatedAt,
      });
    }
  }

  return { ...store, entries, migratedSchema: CURRENT_MIGRATION };
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
