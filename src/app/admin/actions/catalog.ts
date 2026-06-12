"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import * as repo from "@/lib/admin/catalog-repo";
import type { CategoryOverrideValue, ContentType } from "@/types";

/**
 * 카탈로그 관리 서버 액션.
 *
 * 모든 액션은 첫 줄에서 requireAdmin()(throwing variant)을 호출해 관리자임을
 * 확인한 뒤에만 service_role 레포지토리를 호출한다. 변경 후 공개 페이지('/')와
 * 카탈로그 관리 페이지('/admin/catalog')를 revalidate 한다. 공개 페이지는
 * force-dynamic 이라 수정이 즉시 반영되지만, 캐시 일관성을 위해 함께 호출한다.
 */

/** 카탈로그 변경 후 관련 경로 캐시 무효화. */
function revalidateCatalog() {
  revalidatePath("/");
  revalidatePath("/admin/catalog");
}

/** actor 이메일 + 엔티티 id로 변경을 감사 로그에 남긴다. */
function logMutation(actorEmail: string | null, action: string, entityId: string) {
  console.log(`[admin:catalog] ${actorEmail ?? "unknown"} ${action} ${entityId}`);
}

// ────────────────────────────── Seasons ──────────────────────────────

export async function createSeasonAction(input: repo.CreateSeasonInput) {
  const { email } = await requireAdmin();
  const row = await repo.createSeason(input);
  logMutation(email, "createSeason", input.id);
  revalidateCatalog();
  return row;
}

export async function updateSeasonAction(id: string, patch: { name: string }) {
  const { email } = await requireAdmin();
  const row = await repo.updateSeason(id, patch);
  logMutation(email, "updateSeason", id);
  revalidateCatalog();
  return row;
}

export async function deleteSeasonAction(id: string) {
  const { email } = await requireAdmin();
  await repo.deleteSeason(id);
  logMutation(email, "deleteSeason", id);
  revalidateCatalog();
}

export async function reorderSeasonsAction(orderedIds: string[]) {
  const { email } = await requireAdmin();
  await repo.reorderSeasons(orderedIds);
  logMutation(email, "reorderSeasons", orderedIds.join(","));
  revalidateCatalog();
}

// ────────────────────────────── Episodes ──────────────────────────────

export async function createEpisodeAction(input: repo.CreateEpisodeInput) {
  const { email } = await requireAdmin();
  const row = await repo.createEpisode(input);
  logMutation(email, "createEpisode", input.id);
  revalidateCatalog();
  return row;
}

export async function updateEpisodeAction(
  id: string,
  patch: { episode_number?: number; title_ko?: string | null; title_jp?: string | null },
) {
  const { email } = await requireAdmin();
  const row = await repo.updateEpisode(id, patch);
  logMutation(email, "updateEpisode", id);
  revalidateCatalog();
  return row;
}

export async function deleteEpisodeAction(id: string) {
  const { email } = await requireAdmin();
  await repo.deleteEpisode(id);
  logMutation(email, "deleteEpisode", id);
  revalidateCatalog();
}

export async function reorderEpisodesAction(seasonId: string, orderedIds: string[]) {
  const { email } = await requireAdmin();
  await repo.reorderEpisodes(seasonId, orderedIds);
  logMutation(email, "reorderEpisodes", `${seasonId}:${orderedIds.join(",")}`);
  revalidateCatalog();
}

// ────────────────────────────── Contents ──────────────────────────────

export async function createContentAction(input: repo.CreateContentInput) {
  const { email } = await requireAdmin();
  const row = await repo.createContent(input);
  logMutation(email, "createContent", input.id);
  revalidateCatalog();
  return row;
}

/** legacy_video_id는 받지 않는다 — READ-ONLY. */
export async function updateContentAction(
  id: string,
  patch: {
    type?: ContentType;
    title_ko?: string | null;
    title_jp?: string | null;
    part_label?: string | null;
    category_override?: CategoryOverrideValue;
  },
) {
  const { email } = await requireAdmin();
  const row = await repo.updateContent(id, patch);
  logMutation(email, "updateContent", id);
  revalidateCatalog();
  return row;
}

export async function deleteContentAction(id: string) {
  const { email } = await requireAdmin();
  await repo.deleteContent(id);
  logMutation(email, "deleteContent", id);
  revalidateCatalog();
}

export async function reorderContentsAction(episodeId: string, orderedIds: string[]) {
  const { email } = await requireAdmin();
  await repo.reorderContents(episodeId, orderedIds);
  logMutation(email, "reorderContents", `${episodeId}:${orderedIds.join(",")}`);
  revalidateCatalog();
}

// ─────────────────────────── Content sources ───────────────────────────

export async function createContentSourceAction(input: repo.CreateContentSourceInput) {
  const { email } = await requireAdmin();
  const row = await repo.createContentSource(input);
  logMutation(email, "createContentSource", input.content_id);
  revalidateCatalog();
  return row;
}

export async function updateContentSourceAction(
  id: string,
  patch: { url?: string; label?: string | null; timestamp_todo?: boolean },
) {
  const { email } = await requireAdmin();
  const row = await repo.updateContentSource(id, patch);
  logMutation(email, "updateContentSource", id);
  revalidateCatalog();
  return row;
}

export async function deleteContentSourceAction(id: string) {
  const { email } = await requireAdmin();
  await repo.deleteContentSource(id);
  logMutation(email, "deleteContentSource", id);
  revalidateCatalog();
}

export async function reorderContentSourcesAction(contentId: string, orderedIds: string[]) {
  const { email } = await requireAdmin();
  await repo.reorderContentSources(contentId, orderedIds);
  logMutation(email, "reorderContentSources", `${contentId}:${orderedIds.join(",")}`);
  revalidateCatalog();
}
