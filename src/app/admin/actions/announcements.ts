"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import * as repo from "@/lib/admin/announcements-repo";
import type { AnnouncementInput } from "@/lib/admin/announcements-types";

/**
 * 공지 관리 서버 액션.
 *
 * 모든 액션은 첫 줄에서 requireAdmin()(throwing variant)을 호출해 관리자임을
 * 확인한 뒤에만 service_role 레포지토리를 호출한다. 변경 후 공개 페이지 및
 * 공지 관리 페이지를 revalidate 한다.
 */

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

/** 공지 변경 후 관련 경로 캐시 무효화. */
function revalidateAnnouncements(slug?: string) {
  revalidatePath("/");
  revalidatePath("/updates");
  revalidatePath("/admin/announcements");
  if (slug) revalidatePath(`/updates/${slug}`);
}

/** actor 이메일 + 엔티티 id로 변경을 감사 로그에 남긴다. */
function logMutation(actorEmail: string | null, action: string, entityId: string) {
  console.log(`[admin:announcements] ${actorEmail ?? "unknown"} ${action} ${entityId}`);
}

export async function createAnnouncementAction(input: AnnouncementInput) {
  const { email } = await requireAdmin();

  if (!SLUG_RE.test(input.slug)) {
    throw new Error("slug는 소문자·숫자·하이픈만 허용되며 소문자·숫자로 시작해야 합니다.");
  }
  if (!input.title.trim()) throw new Error("제목을 입력해 주세요.");
  if (!input.summary.trim()) throw new Error("한 줄 요약을 입력해 주세요.");
  if (!input.body_md.trim()) throw new Error("본문을 입력해 주세요.");
  if (!input.published_at.trim()) throw new Error("게시일을 입력해 주세요.");

  const row = await repo.createAnnouncement(input);
  logMutation(email, "createAnnouncement", input.slug);
  revalidateAnnouncements(input.slug);
  return row;
}

export async function updateAnnouncementAction(
  slug: string,
  patch: Partial<Omit<AnnouncementInput, "slug">>,
) {
  const { email } = await requireAdmin();

  if (patch.title !== undefined && !patch.title.trim()) throw new Error("제목을 입력해 주세요.");
  if (patch.summary !== undefined && !patch.summary.trim()) throw new Error("한 줄 요약을 입력해 주세요.");
  if (patch.body_md !== undefined && !patch.body_md.trim()) throw new Error("본문을 입력해 주세요.");
  if (patch.published_at !== undefined && !patch.published_at.trim()) throw new Error("게시일을 입력해 주세요.");

  const row = await repo.updateAnnouncement(slug, patch);
  logMutation(email, "updateAnnouncement", slug);
  revalidateAnnouncements(slug);
  return row;
}

export async function deleteAnnouncementAction(slug: string) {
  const { email } = await requireAdmin();
  await repo.deleteAnnouncement(slug);
  logMutation(email, "deleteAnnouncement", slug);
  revalidateAnnouncements(slug);
}
