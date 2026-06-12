/**
 * 공지 레지스트리 — 메타데이터만 담는 순수 데이터 모듈.
 * (React를 import하지 않아 클라이언트 컴포넌트에서도 안전하게 쓸 수 있다)
 *
 * 새 공지 올리는 법:
 * 1. src/content/updates/posts/<slug>.tsx 에 본문 컴포넌트를 만든다
 * 2. posts/index.ts 의 POST_COMPONENTS 에 slug → 컴포넌트를 등록한다
 * 3. 아래 UPDATE_POSTS 맨 앞에 메타데이터를 추가한다
 *    — 맨 앞 글이 메인 화면 배너에 자동으로 노출된다
 */
export interface UpdatePostMeta {
  /** URL 경로: /updates/<slug> */
  slug: string;
  /** 목록·상세 페이지 제목 */
  title: string;
  /** 게시일 (YYYY-MM-DD) */
  date: string;
  /** 목록 한 줄 요약 — 메인 배너 본문으로도 노출 */
  summary: string;
  /** 메인 배너 제목을 페이지 제목과 다르게 쓰고 싶을 때 */
  bannerTitle?: string;
}

/** 최신 글이 맨 앞 (배열 순서 = 노출 순서) */
export const UPDATE_POSTS: UpdatePostMeta[] = [
  {
    slug: "2026-06-v2",
    title: "2026년 6월 업데이트",
    date: "2026-06-12",
    summary: "시청 경험을 다듬고, 새로운 이야기들을 추가했어요.",
    bannerTitle: "llt V2 업데이트",
  },
];

export const latestUpdate = UPDATE_POSTS[0];

/** "2026-06-12" → "2026년 6월 12일" (타임존 영향 없는 문자열 파싱) */
export function formatUpdateDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}
