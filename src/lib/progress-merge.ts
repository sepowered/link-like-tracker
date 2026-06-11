import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CURRENT_MIGRATION,
  saveLocalProgress,
  type LocalProgressStore,
  type ProgressEntry,
} from "./progress-sync";
import { uploadProgress, type RemoteProgressRow } from "./supabase-progress";
import { buildLegacyMap, expandLegacyId } from "./legacy-map";
import { ensureLegacyBackup } from "./legacy-backup";
import type { PlaylistData } from "@/types";
import playlistInitial from "../../data/playlist.initial.json";

// 동기화 엔진 공통 모듈: 원격 행 흡수(remoteToEntries), 레거시 키 미러,
// 업로드 펜스, 그리고 "저장 → 업로드 → 미러 → 이벤트" 커밋 시퀀스(commitStore).
// ProgressSyncProvider에 흩어져 5번 반복되던 코드를 한곳에 모았다.

// Canonical legacy_video_id → content.id map, built ONCE at module load from the
// bundled v2 catalog snapshot (playlist.initial.json, 309 contents).
export const LEGACY_MAP = buildLegacyMap(playlistInitial as unknown as PlaylistData);

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
export async function fencedUpload(
  store: LocalProgressStore,
  supabase: SupabaseClient,
  userId: string,
  devId: string,
  entries: ProgressEntry[],
): Promise<boolean> {
  if (store.migratedSchema !== CURRENT_MIGRATION) return false;
  await uploadProgress(supabase, userId, devId, entries);
  return true;
}

// 미러 재작성은 비파괴여야 한다(하드 제약): 카탈로그가 모르는(unknown) id가
// 기존 레거시 키에 있으면 — 카탈로그에서 삭제됐거나 아주 오래된 데이터 —
// entries에 없어도 버리지 않고 그대로 보존한다. 원본은 ensureLegacyBackup이
// 이미 떠 둔 상태지만, 미러 자체도 잃지 않는 편이 안전하다.
export function writeLegacyKeys(entries: ProgressEntry[]) {
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
export function remoteToEntries(remote: RemoteProgressRow[]): ProgressEntry[] {
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

/**
 * 확정된 스토어를 한 번에 반영하는 커밋 시퀀스:
 * 로컬 저장 → (선택) 펜스 업로드 → 레거시 키 미러 → 동기화 이벤트.
 * 반환값은 업로드가 실제로 실행됐는지 여부 — 호출부가 '업로드 성공 후에만
 * 원격 삭제' 같은 파괴적 후속 작업을 게이트하는 데 쓴다(하드 제약).
 */
export async function commitStore(
  store: LocalProgressStore,
  supabase: SupabaseClient,
  userId: string,
  devId: string,
  options: { upload?: boolean } = {},
): Promise<boolean> {
  const { upload = true } = options;
  const entries = Object.values(store.entries);
  saveLocalProgress(store);
  const uploaded = upload
    ? await fencedUpload(store, supabase, userId, devId, entries)
    : false;
  writeLegacyKeys(entries);
  dispatchSyncEvent();
  return uploaded;
}
