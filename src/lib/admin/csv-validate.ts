/**
 * 카탈로그 CSV 가져오기 검증기 — 순수/클라이언트 안전(service_role 없음).
 *
 * 책임: 헤더 계약, 인코딩(모지바케) 감지, 행별 enum/필수/URL/id 형식 검사,
 * 그리고 단일 시트의 핵심 규칙인 "같은 content_id 행끼리 콘텐츠 열 일치"를 강제한다.
 * 통과한 행을 import_catalog RPC payload({ contents, sources })로 분류한다.
 *
 * 부모(episode_id) 존재 및 신규/기존(legacy_video_id 필수 여부) 판정은 DB 데이터가
 * 필요하므로 서버 액션에서 처리한다 — 여기서는 형식 검증과 분류만 한다(훅 제공).
 */

import {
  CONTENT_LEVEL_COLUMNS,
  CSV_HEADER,
  type CsvRow,
  type ImportContentRow,
  type ImportPayload,
  type ImportSourceRow,
} from "./csv-contract";
import { safeHttpHref } from "@/lib/safe-url";

/** contents.type 7-enum. */
export const CONTENT_TYPES = [
  "story",
  "fesxlive",
  "fesxrec",
  "music",
  "withxmeets",
  "special",
  "unavailable",
] as const;

/** category_override 5-enum(빈 값/null 허용). */
export const CATEGORY_OVERRIDES = ["story", "music", "fesxlive", "withxmeets", "fesxrec"] as const;

export function isValidType(v: string): boolean {
  return (CONTENT_TYPES as readonly string[]).includes(v);
}

/** 빈 문자열이거나 5-enum 중 하나면 유효. */
export function isValidCategoryOverride(v: string): boolean {
  return v === "" || (CATEGORY_OVERRIDES as readonly string[]).includes(v);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

/**
 * 헤더 검증 — 계약의 모든 열이 존재해야 한다(순서 무관, 여분 열은 무시).
 * 문제 없으면 null, 있으면 한국어 오류 메시지.
 */
export function validateHeader(headers: string[]): string | null {
  const present = new Set(headers.map((h) => h.trim()));
  const missing = CSV_HEADER.filter((col) => !present.has(col));
  if (missing.length > 0) {
    return `CSV 헤더에 필요한 열이 없습니다: ${missing.join(", ")}`;
  }
  return null;
}

/**
 * 인코딩 문제 감지 — 디코딩된 텍스트에 U+FFFD(대체 문자)가 있으면 모지바케로 보고 거부.
 * Excel에서 비-UTF-8로 저장하면 한글/일본어가 깨져 이 문자가 끼어든다.
 * 문제 없으면 null, 있으면 한국어 오류 메시지.
 */
export function detectEncodingIssue(text: string): string | null {
  if (text.includes("�")) {
    return "글자 깨짐(인코딩 오류)이 감지됐습니다. 엑셀에서 'CSV UTF-8'로 저장하세요.";
  }
  return null;
}

export interface RowError {
  /** 스프레드시트 줄 번호(헤더=1, 첫 데이터 행=2). */
  row: number;
  reason: string;
}

export interface ImportValidationResult extends ImportPayload {
  errors: RowError[];
}

/**
 * 가져오기 미리보기(서버 액션 산출물) — UI가 "생성/수정/변경없음/오류"로 렌더한다.
 * payload는 차단 오류가 0건일 때만 채워진다(그대로 commit RPC로 전달).
 */
export interface ImportPreview {
  createdContents: number;
  updatedContents: number;
  unchangedContents: number;
  createdSources: number;
  updatedSources: number;
  unchangedSources: number;
  errors: RowError[];
  payload: ImportPayload | null;
}

/** commit RPC 결과 — 성공 시 카운트, 실패 시 롤백 메시지. */
export interface CommitResult {
  ok: boolean;
  summary?: {
    created_contents: number;
    updated_contents: number;
    created_sources: number;
    updated_sources: number;
  };
  error?: string;
}

/** content 한 행이 소스를 갖는지 — source_url 또는 source_id가 있으면 소스 행으로 본다. */
function hasSource(row: CsvRow): boolean {
  return row.source_url.trim() !== "" || row.source_id.trim() !== "";
}

/** "true"/"false"(대소문자 무시)/빈 값을 boolean으로. 그 외는 null(오류). */
function parseTimestampTodo(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (v === "" || v === "false") return false;
  if (v === "true") return true;
  return null;
}

function blankToNull(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : v;
}

/**
 * 행들을 RPC payload로 분류한다.
 *
 * - content_id별로 묶어 콘텐츠 열 일관성을 검사(불일치 시 해당 행 오류).
 * - 콘텐츠는 content_id별 1개(첫 등장 행 기준)로 contents에 모은다.
 * - 소스가 있는 행은 sources로 모은다(소스 없는 행은 콘텐츠만 등록).
 * - 형식 오류는 errors에 모아 반환(부분 통과 없이 액션이 전체를 막을 수 있게).
 *
 * 행 배열 순서가 곧 RPC의 sort_order 순서이므로, 입력 순서를 유지한다.
 */
export function classifyImportRows(rows: CsvRow[]): ImportValidationResult {
  const errors: RowError[] = [];
  const contents: ImportContentRow[] = [];
  const sources: ImportSourceRow[] = [];

  // content_id별 첫 등장 콘텐츠 열(일관성 비교 기준)
  const firstSeen = new Map<string, CsvRow>();

  rows.forEach((row, idx) => {
    const line = idx + 2; // 헤더가 1행
    const contentId = row.content_id.trim();

    if (contentId === "") {
      errors.push({ row: line, reason: "content_id가 비어 있습니다." });
      return;
    }

    // ── 콘텐츠 열 형식 검증 ──
    if (!isValidType(row.type.trim())) {
      errors.push({
        row: line,
        reason: `type이 올바르지 않습니다(${row.type || "빈 값"}). 허용: ${CONTENT_TYPES.join(", ")}`,
      });
      return;
    }
    if (!isValidCategoryOverride(row.category_override.trim())) {
      errors.push({
        row: line,
        reason: `category_override가 올바르지 않습니다(${row.category_override}). 허용: 빈 값, ${CATEGORY_OVERRIDES.join(", ")}`,
      });
      return;
    }
    if (row.episode_id.trim() === "") {
      errors.push({ row: line, reason: "episode_id가 비어 있습니다(부모 에피소드 필요)." });
      return;
    }

    // ── 동일 content_id 행 간 콘텐츠 열 일관성 ──
    const prev = firstSeen.get(contentId);
    if (prev) {
      const mismatched = CONTENT_LEVEL_COLUMNS.filter(
        (col) => (prev[col] ?? "").trim() !== (row[col] ?? "").trim(),
      );
      // episode_id도 콘텐츠 단위 값이므로 함께 검사
      if ((prev.episode_id ?? "").trim() !== row.episode_id.trim()) {
        mismatched.push("episode_id");
      }
      if (mismatched.length > 0) {
        errors.push({
          row: line,
          reason: `같은 content_id(${contentId})의 콘텐츠 열이 다른 행과 일치하지 않습니다: ${mismatched.join(", ")}`,
        });
        return;
      }
    } else {
      firstSeen.set(contentId, row);
      contents.push({
        id: contentId,
        episode_id: row.episode_id.trim(),
        type: row.type.trim(),
        title_ko: blankToNull(row.title_ko),
        title_jp: blankToNull(row.title_jp),
        part_label: blankToNull(row.part_label),
        legacy_video_id: row.legacy_video_id.trim(),
        category_override: row.category_override.trim() === "" ? null : row.category_override.trim(),
      });
    }

    // ── 소스 행 검증/수집 ──
    if (hasSource(row)) {
      const url = row.source_url.trim();
      if (url === "") {
        errors.push({ row: line, reason: "source_id가 있는데 source_url이 비어 있습니다." });
        return;
      }
      if (safeHttpHref(url) === null) {
        errors.push({ row: line, reason: `source_url이 http/https가 아닙니다: ${url}` });
        return;
      }
      const sourceId = row.source_id.trim();
      if (sourceId !== "" && !isUuid(sourceId)) {
        errors.push({ row: line, reason: `source_id가 올바른 uuid가 아닙니다: ${sourceId}` });
        return;
      }
      const ts = parseTimestampTodo(row.timestamp_todo);
      if (ts === null) {
        errors.push({
          row: line,
          reason: `timestamp_todo는 true/false여야 합니다: ${row.timestamp_todo}`,
        });
        return;
      }
      sources.push({
        id: sourceId === "" ? null : sourceId,
        content_id: contentId,
        url,
        label: blankToNull(row.source_label),
        timestamp_todo: ts,
      });
    }
  });

  return { contents, sources, errors };
}
