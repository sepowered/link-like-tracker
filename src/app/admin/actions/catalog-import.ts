"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { getAdminClient } from "@/lib/admin/admin-client";
import { getCatalogAdmin } from "@/lib/admin/catalog-repo";
import { safeHttpHref } from "@/lib/safe-url";
import type { CsvRow, ImportContentRow, ImportPayload } from "@/lib/admin/csv-contract";
import {
  classifyImportRows,
  isUuid,
  isValidCategoryOverride,
  isValidType,
  type CommitResult,
  type ImportPreview,
  type RowError,
} from "@/lib/admin/csv-validate";
import type { AdminContent, AdminContentSource, AdminSeason } from "@/lib/admin/catalog-types";

/**
 * 카탈로그 CSV 가져오기 서버 액션 (2단계: 미리보기 → 커밋).
 *
 * 모든 액션은 첫 줄에서 requireAdmin()(throwing variant)을 호출한다 — 공개
 * 엔드포인트이므로 권한 확인이 최우선이다. 실제 쓰기는 commit이 import_catalog
 * RPC를 service_role로 호출해 한 트랜잭션에 처리한다(부분 쓰기 없음).
 *
 * 클라이언트 입력은 신뢰하지 않는다 — 미리보기/커밋 모두 서버에서 다시 검증한다.
 */

// ─────────────────────────── 기존 카탈로그 평탄화 ───────────────────────────

interface ExistingCatalog {
  episodeIds: Set<string>;
  contentsById: Map<string, AdminContent>;
  sourcesById: Map<string, AdminContentSource>;
}

async function loadExisting(): Promise<ExistingCatalog> {
  const tree: AdminSeason[] = await getCatalogAdmin();
  const episodeIds = new Set<string>();
  const contentsById = new Map<string, AdminContent>();
  const sourcesById = new Map<string, AdminContentSource>();
  for (const season of tree) {
    for (const ep of season.episodes) {
      episodeIds.add(ep.id);
      for (const c of ep.contents) {
        contentsById.set(c.id, c);
        for (const s of c.content_sources) sourcesById.set(s.id, s);
      }
    }
  }
  return { episodeIds, contentsById, sourcesById };
}

/** 콘텐츠 단위 열이 기존 행과 동일한지(legacy_video_id/sort_order 제외 — RPC가 안 건드림). */
function contentUnchanged(next: ImportContentRow, prev: AdminContent): boolean {
  return (
    next.episode_id === prev.episode_id &&
    next.type === prev.type &&
    (next.title_ko ?? null) === (prev.title_ko ?? null) &&
    (next.title_jp ?? null) === (prev.title_jp ?? null) &&
    (next.part_label ?? null) === (prev.part_label ?? null) &&
    (next.category_override ?? null) === (prev.category_override ?? null)
  );
}

// ─────────────────────────── Preview (쓰기 없음) ───────────────────────────

/**
 * 모든 행을 검증/분류하고 기존 DB와 대조해 미리보기를 만든다. 쓰기는 하지 않는다.
 * 차단 오류가 0건일 때만 RPC-ready payload를 함께 반환한다.
 */
export async function previewCatalogImport(rows: CsvRow[]): Promise<ImportPreview> {
  await requireAdmin();

  // 1) 형식/일관성 검증 + 분류 (클라이언트가 검증했더라도 서버에서 다시).
  const classified = classifyImportRows(rows);
  const errors: RowError[] = [...classified.errors];

  // 2) content_id / source_id → 첫 등장 줄번호 맵 (DB 검증 오류를 행에 귀속시키려고).
  const lineByContentId = new Map<string, number>();
  const lineBySourceId = new Map<string, number>();
  rows.forEach((row, idx) => {
    const line = idx + 2; // 헤더가 1행
    const cid = row.content_id.trim();
    if (cid !== "" && !lineByContentId.has(cid)) lineByContentId.set(cid, line);
    const sid = row.source_id.trim();
    if (sid !== "" && !lineBySourceId.has(sid)) lineBySourceId.set(sid, line);
  });

  // 3) 기존 DB 대조.
  const existing = await loadExisting();

  let createdContents = 0;
  let updatedContents = 0;
  let unchangedContents = 0;
  for (const c of classified.contents) {
    const line = lineByContentId.get(c.id) ?? 0;
    // 부모 에피소드 존재 (이 번들은 에피소드를 생성하지 않는다)
    if (!existing.episodeIds.has(c.episode_id)) {
      errors.push({ row: line, reason: `episode_id가 존재하지 않습니다: ${c.episode_id}` });
      continue;
    }
    const prev = existing.contentsById.get(c.id);
    if (!prev) {
      // 신규 콘텐츠 → legacy_video_id 필수
      if (c.legacy_video_id === "") {
        errors.push({ row: line, reason: `새 콘텐츠(${c.id})에는 legacy_video_id가 필요합니다.` });
        continue;
      }
      createdContents += 1;
    } else if (contentUnchanged(c, prev)) {
      unchangedContents += 1;
    } else {
      updatedContents += 1;
    }
  }

  let createdSources = 0;
  let updatedSources = 0;
  let unchangedSources = 0;
  for (const s of classified.sources) {
    if (s.id === null) {
      createdSources += 1;
      continue;
    }
    const prev = existing.sourcesById.get(s.id);
    if (!prev) {
      const line = lineBySourceId.get(s.id) ?? 0;
      errors.push({ row: line, reason: `source_id가 존재하지 않습니다: ${s.id}` });
      continue;
    }
    const same =
      s.url === prev.url &&
      (s.label ?? null) === (prev.label ?? null) &&
      s.timestamp_todo === prev.timestamp_todo &&
      s.content_id === prev.content_id;
    if (same) unchangedSources += 1;
    else updatedSources += 1;
  }

  // 줄번호 오름차순으로 정렬해 표시하기 좋게.
  errors.sort((a, b) => a.row - b.row);

  const payload: ImportPayload | null =
    errors.length === 0 ? { contents: classified.contents, sources: classified.sources } : null;

  return {
    createdContents,
    updatedContents,
    unchangedContents,
    createdSources,
    updatedSources,
    unchangedSources,
    errors,
    payload,
  };
}

// ─────────────────────────── Commit (원자적 RPC) ───────────────────────────

/** 클라이언트 payload를 신뢰하지 않고 서버에서 다시 최소 검증한다. */
function revalidatePayload(payload: ImportPayload): string | null {
  if (!payload || !Array.isArray(payload.contents) || !Array.isArray(payload.sources)) {
    return "payload 형식이 올바르지 않습니다.";
  }
  for (const c of payload.contents) {
    if (!c.id || !c.episode_id) return `콘텐츠에 id/episode_id가 없습니다.`;
    if (!isValidType(c.type)) return `type이 올바르지 않습니다: ${c.type}`;
    if (!isValidCategoryOverride(c.category_override ?? "")) {
      return `category_override가 올바르지 않습니다: ${c.category_override}`;
    }
  }
  for (const s of payload.sources) {
    if (!s.content_id) return "소스에 content_id가 없습니다.";
    if (safeHttpHref(s.url) === null) return `source url이 http/https가 아닙니다: ${s.url}`;
    if (s.id !== null && !isUuid(s.id)) return `source id가 올바른 uuid가 아닙니다: ${s.id}`;
  }
  return null;
}

/**
 * 검증된 payload를 import_catalog RPC로 커밋한다(한 트랜잭션, 원자적).
 * RPC가 제약 위반으로 실패하면 전체 롤백되며 아무것도 적용되지 않는다.
 */
export async function commitCatalogImport(payload: ImportPayload): Promise<CommitResult> {
  const { email } = await requireAdmin();

  const invalid = revalidatePayload(payload);
  if (invalid) {
    return { ok: false, error: invalid };
  }

  const { data, error } = await getAdminClient().rpc("import_catalog", { payload });

  if (error) {
    console.log(
      `[admin:catalog-import] ${email ?? "unknown"} commit FAILED (rolled back): ${error.message}`,
    );
    return {
      ok: false,
      error: `가져오기에 실패해 아무것도 적용되지 않았습니다(전체 롤백): ${error.message}`,
    };
  }

  const summary = data as CommitResult["summary"];
  console.log(
    `[admin:catalog-import] ${email ?? "unknown"} commit ok ` +
      `contents(+${summary?.created_contents ?? 0}/~${summary?.updated_contents ?? 0}) ` +
      `sources(+${summary?.created_sources ?? 0}/~${summary?.updated_sources ?? 0})`,
  );

  revalidatePath("/");
  revalidatePath("/admin/catalog");

  return { ok: true, summary };
}
