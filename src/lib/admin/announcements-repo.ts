import "server-only";

import { getAdminClient } from "./admin-client";
import type { AnnouncementRow, AnnouncementInput } from "./announcements-types";

export type { AnnouncementRow, AnnouncementInput };

/**
 * `announcements` 테이블 CRUD 레포지토리 (service_role).
 *
 * 스키마 단일 출처: supabase/migrations/009_announcements.sql
 * (공개 롤은 is_published 행 SELECT만 가능 — 쓰기는 이 레포지토리 경유가 유일)
 *
 * `import "server-only";` 이므로 클라이언트 번들에 포함될 수 없다.
 * 호출부(서버 액션)는 반드시 requireAdmin()으로 권한을 먼저 확인해야 한다.
 */

const COLUMNS =
  "slug, title, banner_title, summary, body_md, published_at, is_published, created_at, updated_at";

/** 전체 공지 목록 (게시 여부 무관, 게시일 내림차순). */
export async function listAnnouncements(): Promise<AnnouncementRow[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("announcements")
    .select(COLUMNS)
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`공지 목록 조회 실패: ${error.message}`);
  return (data ?? []) as AnnouncementRow[];
}

export async function getAnnouncement(slug: string): Promise<AnnouncementRow | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("announcements")
    .select(COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`공지 조회 실패: ${error.message}`);
  return (data as AnnouncementRow) ?? null;
}

export async function createAnnouncement(input: AnnouncementInput): Promise<AnnouncementRow> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("announcements")
    .insert(input)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(`공지 생성 실패: ${error.message}`);
  return data as AnnouncementRow;
}

export async function updateAnnouncement(
  slug: string,
  patch: Partial<Omit<AnnouncementInput, "slug">>,
): Promise<AnnouncementRow> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("announcements")
    .update(patch)
    .eq("slug", slug)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(`공지 수정 실패: ${error.message}`);
  return data as AnnouncementRow;
}

export async function deleteAnnouncement(slug: string): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await supabase.from("announcements").delete().eq("slug", slug);
  if (error) throw new Error(`공지 삭제 실패: ${error.message}`);
}
