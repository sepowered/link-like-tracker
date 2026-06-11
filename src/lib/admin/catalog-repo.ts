import "server-only";

import type { CategoryOverrideValue, ContentType } from "@/types";
import type { AdminSeason } from "./catalog-types";
import { assertHttpUrl } from "@/lib/safe-url";
import { getAdminClient } from "./admin-client";

/**
 * 카탈로그(seasons → episodes → contents → content_sources) 쓰기 레포지토리.
 *
 * 모든 쓰기는 service_role 클라이언트(getAdminClient)로만 수행한다. 이 파일은
 * `import "server-only";` 이므로 클라이언트 번들에 포함될 수 없다. 호출부(서버
 * 액션)는 반드시 requireAdmin()으로 권한을 먼저 확인해야 한다.
 *
 * 주의 — legacy_video_id는 모든 쓰기 경로에서 READ-ONLY다. 1→N 분할이 같은 값을
 * 공유하고(non-unique), user_progress.video_id가 FK 없이 이 값을 참조하므로 수정/
 * 재배치 시 시청 기록이 어긋난다. 따라서 update 시그니처에서 의도적으로 제외한다.
 *
 * 삭제 주의 — FK가 on delete cascade라서 상위 행을 지우면 하위 행이 함께 사라진다.
 * 특히 content를 지우면 그 legacy_video_id를 참조하던 user_progress 행은 FK가 없어
 * "고아"가 된다(자동 정리되지 않음). UI는 삭제 전 이 점을 경고해야 한다.
 */

function db() {
  return getAdminClient();
}

function throwOnError(error: { message: string; code?: string } | null, context: string): void {
  if (error) {
    throw new Error(`[catalog-repo:${context}] ${error.message}${error.code ? ` (${error.code})` : ""}`);
  }
}

/**
 * 새 행에 부여할 sort_order를 서버에서 계산한다 = (그룹 내 현재 max) + 1.
 *
 * 클라이언트가 넘긴 length/index를 신뢰하지 않는다 — 비-말단(non-tail) 삭제 후에는
 * length가 실제 max와 어긋나 content_sources의 UNIQUE(content_id, sort_order)
 * 충돌을 일으킬 수 있기 때문이다. 그룹이 비어 있으면 0에서 시작한다.
 */
async function nextSortOrder(
  table: "seasons" | "episodes" | "contents" | "content_sources",
  filter?: { col: string; val: string },
): Promise<number> {
  let query = db().from(table).select("sort_order");
  if (filter) query = query.eq(filter.col, filter.val);
  const { data, error } = await query
    .order("sort_order", { ascending: false })
    .limit(1)
    .returns<{ sort_order: number }[]>();
  throwOnError(error, `nextSortOrder:${table}`);
  const max = data && data.length > 0 ? data[0].sort_order : -1;
  return max + 1;
}

// ────────────────────────────── Seasons ──────────────────────────────

export interface CreateSeasonInput {
  id: string; // text PK, 앱이 부여 (예: "103-main")
  name: string;
  sort_order?: number; // 무시됨 — 서버에서 max+1로 계산. 호환을 위해 optional로 남김.
}

export async function createSeason(input: CreateSeasonInput) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- sort_order is intentionally excluded from the spread; server recomputes it
  const { sort_order: _sortOrder, ...rest } = input;
  const sort_order = await nextSortOrder("seasons");
  const { data, error } = await db()
    .from("seasons")
    .insert({ ...rest, sort_order })
    .select()
    .single();
  throwOnError(error, "createSeason");
  return data;
}

export async function updateSeason(id: string, patch: { name: string }) {
  const { data, error } = await db()
    .from("seasons")
    .update({ name: patch.name })
    .eq("id", id)
    .select()
    .single();
  throwOnError(error, "updateSeason");
  return data;
}

export async function deleteSeason(id: string) {
  const { error } = await db().from("seasons").delete().eq("id", id);
  throwOnError(error, "deleteSeason");
}

/** orderedIds 순서대로 sort_order = 0,1,2… 를 부여한다. seasons에는 unique 제약이 없어 단순 순차 갱신으로 충분. */
export async function reorderSeasons(orderedIds: string[]) {
  const supabase = db();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from("seasons").update({ sort_order: i }).eq("id", orderedIds[i]);
    throwOnError(error, "reorderSeasons");
  }
}

// ────────────────────────────── Episodes ──────────────────────────────

export interface CreateEpisodeInput {
  id: string; // text PK (playlist.json episode.id)
  season_id: string;
  episode_number: number;
  title_ko?: string | null;
  title_jp?: string | null;
  sort_order?: number; // 무시됨 — 서버에서 (시즌 내 max)+1로 계산.
}

export async function createEpisode(input: CreateEpisodeInput) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- sort_order is intentionally excluded from the spread; server recomputes it
  const { sort_order: _sortOrder, ...rest } = input;
  const sort_order = await nextSortOrder("episodes", { col: "season_id", val: input.season_id });
  const { data, error } = await db()
    .from("episodes")
    .insert({ ...rest, sort_order })
    .select()
    .single();
  throwOnError(error, "createEpisode");
  return data;
}

export async function updateEpisode(
  id: string,
  patch: { episode_number?: number; title_ko?: string | null; title_jp?: string | null },
) {
  const { data, error } = await db().from("episodes").update(patch).eq("id", id).select().single();
  throwOnError(error, "updateEpisode");
  return data;
}

export async function deleteEpisode(id: string) {
  const { error } = await db().from("episodes").delete().eq("id", id);
  throwOnError(error, "deleteEpisode");
}

/** 한 시즌 내 에피소드 재정렬. episodes에 unique 제약 없음 → 순차 갱신. */
export async function reorderEpisodes(_seasonId: string, orderedIds: string[]) {
  const supabase = db();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from("episodes").update({ sort_order: i }).eq("id", orderedIds[i]);
    throwOnError(error, "reorderEpisodes");
  }
}

// ────────────────────────────── Contents ──────────────────────────────

export interface CreateContentInput {
  id: string; // NEW v2 content.id (예: "3_bZr1vzepk_p1")
  episode_id: string;
  type: ContentType;
  title_ko?: string | null;
  title_jp?: string | null;
  part_label?: string | null;
  legacy_video_id: string; // 생성 시에만 설정, 이후 수정 불가
  sort_order?: number; // 무시됨 — 서버에서 (에피소드 내 max)+1로 계산.
  category_override?: CategoryOverrideValue;
}

export async function createContent(input: CreateContentInput) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- sort_order is intentionally excluded from the spread; server recomputes it
  const { sort_order: _sortOrder, ...rest } = input;
  const sort_order = await nextSortOrder("contents", { col: "episode_id", val: input.episode_id });
  const { data, error } = await db()
    .from("contents")
    .insert({ ...rest, sort_order })
    .select()
    .single();
  throwOnError(error, "createContent");
  return data;
}

/** legacy_video_id는 의도적으로 제외 — READ-ONLY. */
export async function updateContent(
  id: string,
  patch: {
    type?: ContentType;
    title_ko?: string | null;
    title_jp?: string | null;
    part_label?: string | null;
    category_override?: CategoryOverrideValue;
  },
) {
  const { data, error } = await db().from("contents").update(patch).eq("id", id).select().single();
  throwOnError(error, "updateContent");
  return data;
}

export async function deleteContent(id: string) {
  const { error } = await db().from("contents").delete().eq("id", id);
  throwOnError(error, "deleteContent");
}

/** 한 에피소드 내 콘텐츠 재정렬. contents에 unique 제약 없음 → 순차 갱신. */
export async function reorderContents(_episodeId: string, orderedIds: string[]) {
  const supabase = db();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from("contents").update({ sort_order: i }).eq("id", orderedIds[i]);
    throwOnError(error, "reorderContents");
  }
}

// ─────────────────────────── Content sources ───────────────────────────

export interface CreateContentSourceInput {
  content_id: string;
  url: string;
  label?: string | null;
  timestamp_todo?: boolean;
  sort_order?: number; // 무시됨 — 서버에서 (content 내 max)+1로 계산. UNIQUE 충돌 방지.
}

export async function createContentSource(input: CreateContentSourceInput) {
  assertHttpUrl(input.url); // 잘못된 스킴(javascript:/data: 등)이 저장되지 않게 막는다
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- sort_order is intentionally excluded from the spread; server recomputes it
  const { sort_order: _sortOrder, ...rest } = input;
  const sort_order = await nextSortOrder("content_sources", {
    col: "content_id",
    val: input.content_id,
  });
  const { data, error } = await db()
    .from("content_sources")
    .insert({ ...rest, sort_order })
    .select()
    .single();
  throwOnError(error, "createContentSource");
  return data;
}

export async function updateContentSource(
  id: string,
  patch: { url?: string; label?: string | null; timestamp_todo?: boolean },
) {
  if (patch.url !== undefined) assertHttpUrl(patch.url);
  const { data, error } = await db().from("content_sources").update(patch).eq("id", id).select().single();
  throwOnError(error, "updateContentSource");
  return data;
}

export async function deleteContentSource(id: string) {
  const { error } = await db().from("content_sources").delete().eq("id", id);
  throwOnError(error, "deleteContentSource");
}

/**
 * 한 content의 소스 재정렬.
 *
 * content_sources에는 UNIQUE(content_id, sort_order)가 있어, 단순히 0,1,2…로
 * 갱신하면 중간 단계에서 두 행이 같은 sort_order를 갖는 순간 제약 위반이 난다.
 * 따라서 2단계로 처리한다:
 *   1) 대상 행을 모두 sort_order + 10000 으로 옮겨 0..n-1 범위를 비운다.
 *   2) orderedIds 순서대로 0,1,2… 최종값을 부여한다(10000+ 와 절대 충돌하지 않음).
 * 각 단계는 행 단위 순차 갱신이라 매 순간 유니크가 유지된다.
 */
export async function reorderContentSources(_contentId: string, orderedIds: string[]) {
  const supabase = db();
  const OFFSET = 10000;

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("content_sources")
      .update({ sort_order: OFFSET + i })
      .eq("id", orderedIds[i]);
    throwOnError(error, "reorderContentSources(stage1)");
  }

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("content_sources")
      .update({ sort_order: i })
      .eq("id", orderedIds[i]);
    throwOnError(error, "reorderContentSources(stage2)");
  }
}

// ─────────────────────────── Admin read (full tree with IDs) ───────────────────────────

/**
 * 관리자용 전체 카탈로그 조회 — content_sources.id 등 모든 PK를 포함한다.
 * 공개 페이지의 supabaseStorage.getPlaylist()와 달리 id 컬럼도 셀렉트한다.
 * service_role 읽기이므로 호출부(서버 컴포넌트/액션)는 먼저 requireAdmin() 할 것.
 */
export async function getCatalogAdmin(): Promise<AdminSeason[]> {
  const { data, error } = await db()
    .from("seasons")
    .select(
      "id, name, sort_order, " +
        "episodes(id, season_id, episode_number, title_ko, title_jp, sort_order, " +
        "contents(id, episode_id, type, title_ko, title_jp, part_label, legacy_video_id, sort_order, category_override, " +
        "content_sources(id, content_id, url, label, timestamp_todo, sort_order)))",
    )
    .returns<AdminSeason[]>();

  if (error) throw error;

  // 3단계 중첩 정렬 — PostgREST 정렬보다 JS 정렬이 결정론적이므로 동일 방식 사용
  return [...(data ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({
      ...s,
      episodes: [...(s.episodes ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((e) => ({
          ...e,
          contents: [...(e.contents ?? [])]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((c) => ({
              ...c,
              content_sources: [...(c.content_sources ?? [])].sort(
                (x, y) => x.sort_order - y.sort_order,
              ),
            })),
        })),
    }));
}
