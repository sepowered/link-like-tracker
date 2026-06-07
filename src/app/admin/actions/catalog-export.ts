"use server";

import "server-only";

import { requireAdmin } from "@/lib/admin/require-admin";
import { getCatalogAdmin } from "@/lib/admin/catalog-repo";
import { CSV_HEADER, csvRowToValues } from "@/lib/admin/csv-contract";
import type { CsvRow } from "@/lib/admin/csv-contract";

/**
 * 카탈로그 전체를 단일 long-format CSV 문자열로 내보낸다.
 *
 * - 한 행 = 하나의 content_source.
 * - 소스가 0개인 콘텐츠는 소스 열이 빈 1행으로 표현된다.
 * - 콘텐츠 열은 같은 content_id를 공유하는 모든 행에 반복된다.
 * - 결정적 정렬: season sort_order → episode sort_order → content sort_order → source sort_order.
 * - RFC-4180 인용 + UTF-8 BOM. 프리픽스 가드 없음(라운드트립 결정성, plan M5).
 * - source_id(uuid) 포함 — 재가져오기 시 UPDATE 키로 쓰인다.
 *
 * 반환값: UTF-8 BOM이 붙은 CSV 문자열. 클라이언트가 Blob 다운로드를 트리거한다.
 */
export async function exportCatalogCsvAction(): Promise<string> {
  await requireAdmin();

  const seasons = await getCatalogAdmin();

  const rows: CsvRow[] = [];

  for (const season of seasons) {
    for (const episode of season.episodes) {
      for (const content of episode.contents) {
        // 콘텐츠 열 — 모든 소스 행에 반복됨
        const contentCols = {
          season_id: season.id,
          season_name: season.name,
          episode_id: episode.id,
          episode_number: String(episode.episode_number),
          content_id: content.id,
          type: content.type,
          title_ko: content.title_ko ?? "",
          title_jp: content.title_jp ?? "",
          part_label: content.part_label ?? "",
          legacy_video_id: content.legacy_video_id,
          category_override: content.category_override ?? "",
        };

        if (content.content_sources.length === 0) {
          // 소스 없는 콘텐츠 → 소스 열 빈 1행
          rows.push({
            ...contentCols,
            source_id: "",
            source_url: "",
            source_label: "",
            timestamp_todo: "",
          });
        } else {
          for (const source of content.content_sources) {
            rows.push({
              ...contentCols,
              source_id: source.id,
              source_url: source.url,
              source_label: source.label ?? "",
              timestamp_todo: source.timestamp_todo ? "true" : "false",
            });
          }
        }
      }
    }
  }

  return serializeCsv(rows);
}

// ─────────────────────────── CSV 직렬화 ───────────────────────────

/** RFC-4180: 쉼표·큰따옴표·개행을 포함하는 필드는 큰따옴표로 감싸고, 내부 큰따옴표는 두 번 쓴다. */
function quoteField(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function serializeCsv(rows: CsvRow[]): string {
  const UTF8_BOM = "﻿";
  const CRLF = "\r\n";

  const lines: string[] = [];

  // 헤더 행
  lines.push(CSV_HEADER.map(quoteField).join(","));

  // 데이터 행
  for (const row of rows) {
    lines.push(csvRowToValues(row).map(quoteField).join(","));
  }

  return UTF8_BOM + lines.join(CRLF);
}
