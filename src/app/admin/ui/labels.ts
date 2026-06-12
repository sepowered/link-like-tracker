/**
 * 백오피스 공용 라벨/선택지 — 지시어 없는 순수 모듈(서버/클라이언트 공용).
 * 콘텐츠 타입·분류 덮어쓰기 enum은 004_catalog_v2.sql CHECK 제약이 원천.
 */

import type { ContentType } from "@/types";

export const CONTENT_TYPE_OPTIONS: { value: ContentType; label: string }[] = [
  { value: "story", label: "스토리" },
  { value: "music", label: "음악" },
  { value: "fesxlive", label: "Fes×LIVE" },
  { value: "fesxrec", label: "Fes×ReC" },
  { value: "withxmeets", label: "With×MEETS" },
  { value: "special", label: "스페셜" },
  { value: "unavailable", label: "비공개" },
];

export const CONTENT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  CONTENT_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

/** category_override 선택지 — ""(빈 값)은 null(자동)로 직렬화한다. */
export const CATEGORY_OVERRIDE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "자동(타입 따름)" },
  { value: "story", label: "스토리" },
  { value: "music", label: "음악" },
  { value: "fesxlive", label: "Fes×LIVE" },
  { value: "fesxrec", label: "Fes×ReC" },
  { value: "withxmeets", label: "With×MEETS" },
];

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}
