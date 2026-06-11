/**
 * 카탈로그 CSV(단일 시트, long-format) 열 계약.
 *
 * 지시어 없는 순수 모듈 — 서버/클라이언트 양쪽에서 import 가능(service_role 없음).
 *
 * 한 줄 = 하나의 content_source. 소스가 N개인 콘텐츠는 N행으로 펼쳐지고(콘텐츠 열 반복),
 * 소스가 0개인 콘텐츠는 소스 열이 빈 1행으로 표현된다.
 *
 * 키:
 *   - content_id (text PK): 빈 값 불가. 기존이면 UPDATE, 신규면 INSERT(legacy_video_id 필수).
 *   - source_id (uuid):     빈 값 → INSERT(gen_random_uuid), 값 있으면 UPDATE by id.
 *
 * 읽기 전용 컨텍스트 열(season_id/season_name/episode_id/episode_number)은 사람이 어느
 * 콘텐츠인지 알아보기 위한 것. 가져오기에서 episode_id만 (부모 참조로) 의미를 갖고
 * 나머지 시즌/에피소드 열은 무시된다(시즌/에피소드는 그리드에서 편집).
 */

/** 안정적인 헤더 순서. 내보내기/가져오기 양쪽이 이 배열을 단일 진실로 쓴다. */
export const CSV_HEADER = [
  // 읽기 전용 컨텍스트
  "season_id",
  "season_name",
  "episode_id",
  "episode_number",
  // 콘텐츠 열
  "content_id",
  "type",
  "title_ko",
  "title_jp",
  "part_label",
  "legacy_video_id",
  "category_override",
  // 소스 열
  "source_id",
  "source_url",
  "source_label",
  "timestamp_todo",
] as const;

export type CsvColumn = (typeof CSV_HEADER)[number];

/** 한 CSV 행 = 모든 열을 문자열로 가진 객체(papaparse header:true 산출물과 호환). */
export type CsvRow = Record<CsvColumn, string>;

/** content 단위 식별/내용 열 묶음 — 동일 content_id 행 간 일관성 검사에 사용. */
export const CONTENT_LEVEL_COLUMNS: CsvColumn[] = [
  "type",
  "title_ko",
  "title_jp",
  "part_label",
  "legacy_video_id",
  "category_override",
];

// ─────────────────────────── RPC payload 계약 ───────────────────────────
// 검증을 통과한 행을 import_catalog(payload jsonb) RPC로 보내는 형태.
// payload = { contents: ImportContentRow[], sources: ImportSourceRow[] }

export interface ImportContentRow {
  id: string;
  episode_id: string;
  type: string;
  title_ko: string | null;
  title_jp: string | null;
  part_label: string | null;
  /** INSERT 시에만 적용됨(RPC가 UPDATE에서는 무시). */
  legacy_video_id: string;
  /** 5-enum 또는 null. */
  category_override: string | null;
}

export interface ImportSourceRow {
  /** uuid; null → INSERT, 값 있으면 UPDATE by id. */
  id: string | null;
  content_id: string;
  url: string;
  label: string | null;
  timestamp_todo: boolean;
}

export interface ImportPayload {
  contents: ImportContentRow[];
  sources: ImportSourceRow[];
}

// ─────────────────────────── 행 ↔ 객체 매퍼 ───────────────────────────

/**
 * 임의 키의 파싱 객체(papaparse header:true)를 안정적인 CsvRow로 정규화한다.
 * 누락 열은 빈 문자열로, 값은 trim 없이(round-trip 결정성) 그대로 담는다.
 */
export function toCsvRow(raw: Record<string, unknown>): CsvRow {
  const out = {} as CsvRow;
  for (const col of CSV_HEADER) {
    const v = raw[col];
    out[col] = v == null ? "" : String(v);
  }
  return out;
}

/** CsvRow를 헤더 순서의 문자열 배열로(내보내기/직렬화용). */
export function csvRowToValues(row: CsvRow): string[] {
  return CSV_HEADER.map((col) => row[col] ?? "");
}

/** 헤더 순서의 문자열 배열을 CsvRow로(직렬화 역변환용). */
export function valuesToCsvRow(values: string[]): CsvRow {
  const out = {} as CsvRow;
  CSV_HEADER.forEach((col, i) => {
    out[col] = values[i] ?? "";
  });
  return out;
}
