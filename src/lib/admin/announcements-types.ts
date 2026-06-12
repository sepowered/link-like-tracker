/**
 * 공지 타입 — 순수 타입 모듈 (클라이언트 컴포넌트에서도 import 가능).
 * 스키마 단일 출처: supabase/migrations/009_announcements.sql
 */

export interface AnnouncementRow {
  slug: string;
  title: string;
  banner_title: string | null;
  summary: string;
  body_md: string;
  /** YYYY-MM-DD */
  published_at: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementInput {
  slug: string;
  title: string;
  banner_title: string | null;
  summary: string;
  body_md: string;
  /** YYYY-MM-DD */
  published_at: string;
  is_published: boolean;
}

/** 메인 배너에 내려주는 슬림 메타 (본문 제외). */
export interface AnnouncementBanner {
  slug: string;
  title: string;
  bannerTitle: string | null;
  summary: string;
}

/** "2026-06-12" → "2026년 6월 12일" (타임존 영향 없는 문자열 파싱) */
export function formatAnnouncementDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}
