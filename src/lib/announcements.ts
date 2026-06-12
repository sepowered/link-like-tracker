import "server-only";

import { createClient } from "@supabase/supabase-js";
import type {
  AnnouncementRow,
  AnnouncementBanner,
} from "./admin/announcements-types";

/**
 * 공개 공지 읽기 (anon key — RLS가 is_published 행만 허용).
 * 쓰기는 src/lib/admin/announcements-repo.ts (service_role) 전용.
 */

export type PublicAnnouncement = Omit<AnnouncementRow, "created_at" | "updated_at">;
export type { AnnouncementBanner };

function getPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const COLUMNS = "slug, title, banner_title, summary, body_md, published_at, is_published";

/** 게시된 공지 목록 (게시일 내림차순). */
export async function listPublishedAnnouncements(): Promise<PublicAnnouncement[]> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("announcements")
    .select(COLUMNS)
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`공지 목록 조회 실패: ${error.message}`);
  return (data ?? []) as PublicAnnouncement[];
}

export async function getPublishedAnnouncement(
  slug: string,
): Promise<PublicAnnouncement | null> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from("announcements")
    .select(COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`공지 조회 실패: ${error.message}`);
  return (data as PublicAnnouncement) ?? null;
}

/**
 * 메인 배너용 최신 공지. 실패하면 null — 공지 조회 장애가
 * 메인 화면 렌더링을 막으면 안 된다.
 */
export async function getLatestAnnouncementBanner(): Promise<AnnouncementBanner | null> {
  try {
    const supabase = getPublicClient();
    const { data, error } = await supabase
      .from("announcements")
      .select("slug, title, banner_title, summary")
      .order("published_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      slug: data.slug,
      title: data.title,
      bannerTitle: data.banner_title,
      summary: data.summary,
    };
  } catch {
    return null;
  }
}
