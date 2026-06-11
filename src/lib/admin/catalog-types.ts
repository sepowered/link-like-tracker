/**
 * 관리자용 카탈로그 트리 타입.
 *
 * 지시어(`"use server"`/`"use client"`) 없는 순수 타입 모듈 — 서버 컴포넌트,
 * 서버 액션, 클라이언트 컴포넌트 어디서든 `import type`으로 가져올 수 있다.
 * (서버 액션 파일에 인터페이스를 두면 "use server" 모듈이 값 외의 export를 갖게 되어
 *  빌드 경계 위반이 나므로 여기로 분리한다.)
 *
 * 공개 PlaylistData와 달리 content_sources.id 등 모든 PK를 포함한다.
 */

import type { CategoryOverrideValue, ContentType } from "@/types";

export interface AdminContentSource {
  id: string;
  content_id: string;
  url: string;
  label: string | null;
  timestamp_todo: boolean;
  sort_order: number;
}

export interface AdminContent {
  id: string;
  episode_id: string;
  type: ContentType;
  title_ko: string | null;
  title_jp: string | null;
  part_label: string | null;
  legacy_video_id: string;
  sort_order: number;
  category_override: CategoryOverrideValue;
  content_sources: AdminContentSource[];
}

export interface AdminEpisode {
  id: string;
  season_id: string;
  episode_number: number;
  title_ko: string | null;
  title_jp: string | null;
  sort_order: number;
  contents: AdminContent[];
}

export interface AdminSeason {
  id: string;
  name: string;
  sort_order: number;
  episodes: AdminEpisode[];
}
