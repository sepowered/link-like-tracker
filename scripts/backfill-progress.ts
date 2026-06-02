/**
 * user_progress 레거시 YouTube id → v2 content.id 백필 스크립트 (멱등/재실행 안전).
 *
 * 카탈로그 `contents` 테이블을 단일 진실 소스로 삼아 user_progress.video_id 를
 * v2 content.id 로 리맵한다. 분할(1→N) 레거시 부모는 모든 파트로 확장한다.
 * 레거시 행은 삭제하지 않고 읽기 전용으로 보존(롤백/클라이언트 표시 호환).
 * in-memory 로 status-union 을 계산한 뒤 supabase-js upsert 로 원하는 상태를 기록한다.
 *
 * 실행:
 *   npx tsx --env-file .env.local scripts/backfill-progress.ts            # 실제 변경(쓰기)
 *   npx tsx --env-file .env.local scripts/backfill-progress.ts --dry-run  # 시뮬레이션(쓰기 없음)
 *
 * 타임스탬프 정책: 원본 updated_at 만 사용한다. now()/Date.now() 를 절대 쓰지 않는다.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

type Status = "watched" | "unwatched";

interface ProgressRow {
  user_id: string;
  device_id: string;
  video_id: string;
  status: Status;
  category_override: string | null;
  updated_at: string;
}

interface DesiredRow {
  user_id: string;
  device_id: string;
  video_id: string; // content.id
  status: Status;
  category_override: string | null;
  updated_at: string;
}

const dryRun = process.argv.includes("--dry-run");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 누락"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const UPSERT_BATCH = 500;

/** watched 가 이기는 status union */
function unionStatus(a: Status, b: Status): Status {
  return a === "watched" || b === "watched" ? "watched" : "unwatched";
}

/** ISO 문자열 비교(둘 다 동일 포맷 가정) — 더 늦은 값 반환 */
function maxTimestamp(a: string, b: string): string {
  return a >= b ? a : b;
}

/**
 * 카탈로그 `contents` 테이블에서 canonical 맵을 빌드한다 (단일 진실 소스).
 * contents 가 비어 있으면 시드되지 않은 것이므로 중단.
 */
async function buildMapFromCatalog(): Promise<{
  contentIds: Set<string>;
  legacyToContentIds: Map<string, string[]>;
}> {
  const { data, error } = await supabase
    .from("contents")
    .select("id, legacy_video_id");
  if (error) throw new Error(`contents 조회 실패: ${error.message}`);

  if (!data || data.length === 0) {
    console.error(
      "❌ contents 테이블이 비어 있습니다 — 카탈로그가 시드되지 않았습니다 (scripts/seed-catalog.ts 먼저 실행)."
    );
    process.exit(1);
  }

  const contentIds = new Set<string>();
  const legacyToContentIds = new Map<string, string[]>();
  for (const row of data as { id: string; legacy_video_id: string }[]) {
    contentIds.add(row.id);
    const existing = legacyToContentIds.get(row.legacy_video_id);
    if (existing) existing.push(row.id);
    else legacyToContentIds.set(row.legacy_video_id, [row.id]);
  }
  return { contentIds, legacyToContentIds };
}

/** user_progress 전체 로드(페이지네이션) */
async function loadAllProgress(): Promise<ProgressRow[]> {
  const rows: ProgressRow[] = [];
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("user_progress")
      .select("user_id, device_id, video_id, status, category_override, updated_at")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`user_progress 조회 실패: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as ProgressRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

/** user_progress 총 행 수(검증용) */
async function countProgress(): Promise<number> {
  const { count, error } = await supabase
    .from("user_progress")
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`user_progress count 실패: ${error.message}`);
  return count ?? 0;
}

async function main(): Promise<void> {
  console.log(
    `\n=== user_progress 백필 ${dryRun ? "(--dry-run, 쓰기 없음)" : "(실제 실행)"} ===\n`
  );

  // 1. 카탈로그에서 canonical 맵 빌드
  const { contentIds, legacyToContentIds } = await buildMapFromCatalog();
  console.log(
    `카탈로그: content.id ${contentIds.size}개, distinct legacy_video_id ${legacyToContentIds.size}개`
  );

  // 2. 모든 progress 로드
  const beforeCount = await countProgress();
  const progress = await loadAllProgress();
  console.log(`user_progress 행: ${progress.length}개 (count=${beforeCount})\n`);

  // 3. 각 행 분류
  const unknownCounts = new Map<string, number>(); // video_id → 행 수
  const splitParentExpansion = new Map<string, number>(); // legacy split id → 확장 content.id 수
  const splitParentUsers = new Map<string, Set<string>>(); // legacy split id → 본 user 집합

  // 5. content.id 키 기반 desired state(UNION) 계산
  const desired = new Map<string, DesiredRow>(); // `${user}|${device}|${contentId}`

  function classify(videoId: string): {
    kind: "content" | "split" | "unknown";
    targets: string[];
  } {
    if (contentIds.has(videoId)) {
      return { kind: "content", targets: [videoId] };
    }
    const mapped = legacyToContentIds.get(videoId);
    if (mapped) {
      return { kind: "split", targets: mapped };
    }
    return { kind: "unknown", targets: [] };
  }

  for (const row of progress) {
    const { kind, targets } = classify(row.video_id);

    if (kind === "unknown") {
      unknownCounts.set(
        row.video_id,
        (unknownCounts.get(row.video_id) ?? 0) + 1
      );
      continue; // desired state 에 기여하지 않음
    }

    if (kind === "split") {
      splitParentExpansion.set(row.video_id, targets.length);
      const users = splitParentUsers.get(row.video_id) ?? new Set<string>();
      users.add(row.user_id);
      splitParentUsers.set(row.video_id, users);
    }

    for (const contentId of targets) {
      const key = `${row.user_id}|${row.device_id}|${contentId}`;
      const existing = desired.get(key);
      if (!existing) {
        desired.set(key, {
          user_id: row.user_id,
          device_id: row.device_id,
          video_id: contentId,
          status: row.status,
          category_override: row.category_override,
          updated_at: row.updated_at,
        });
      } else {
        existing.status = unionStatus(existing.status, row.status);
        existing.updated_at = maxTimestamp(existing.updated_at, row.updated_at);
        // override 충돌: non-null 우선, 아니면 기존 유지
        if (existing.category_override == null && row.category_override != null) {
          existing.category_override = row.category_override;
        }
      }
    }
  }

  // 분할 부모 리포트
  console.log("--- 분할(1→N) 레거시 부모 video_id (user_progress 내 발견) ---");
  if (splitParentExpansion.size === 0) {
    console.log("  (없음)");
  } else {
    const sorted = [...splitParentExpansion.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    );
    for (const [legacyId, parts] of sorted) {
      const userCount = splitParentUsers.get(legacyId)?.size ?? 0;
      console.log(
        `  ${legacyId} → ${parts} content.id 로 확장 (user ${userCount}명이 본 상태)`
      );
    }
  }

  // 4. UNKNOWN hard-abort / warning
  console.log("\n--- UNKNOWN video_id (zero contents 매핑) ---");
  if (unknownCounts.size === 0) {
    console.log("  (없음)");
  } else {
    const sortedUnknown = [...unknownCounts.entries()].sort(
      (a, b) => b[1] - a[1]
    );
    for (const [videoId, count] of sortedUnknown) {
      console.log(`  ${videoId} — ${count}행`);
    }
    if (dryRun) {
      console.warn(
        `\n⚠️  WARNING: ${unknownCounts.size}개의 UNKNOWN video_id 발견. ` +
          `실제 실행 시에는 여기서 hard-abort(쓰기 전, 비정상 종료)합니다. dry-run 은 계속 진행합니다.`
      );
    } else {
      console.error(
        `\n❌ ${unknownCounts.size}개의 UNKNOWN video_id 가 zero contents 로 매핑됩니다. ` +
          `쓰기 없이 중단합니다(카탈로그 드리프트/부분 시드 가능성).`
      );
      process.exit(1);
    }
  }

  // 현재 (user|device|content.id) 상태 — INSERT vs UPDATE 판정용
  const currentContentKeyed = new Map<string, ProgressRow>();
  for (const row of progress) {
    if (contentIds.has(row.video_id)) {
      currentContentKeyed.set(
        `${row.user_id}|${row.device_id}|${row.video_id}`,
        row
      );
    }
  }

  let toInsert = 0;
  let toUpdate = 0;
  const upsertRows: DesiredRow[] = [];
  for (const [key, want] of desired) {
    const cur = currentContentKeyed.get(key);
    if (!cur) {
      toInsert += 1;
      upsertRows.push(want);
    } else if (
      cur.status !== want.status ||
      cur.updated_at !== want.updated_at ||
      (cur.category_override ?? null) !== (want.category_override ?? null)
    ) {
      toUpdate += 1;
      upsertRows.push(want);
    }
    // 동일하면 no-op
  }

  console.log("\n--- desired state 델타 ---");
  console.log(`  INSERT(신규 content.id 행): ${toInsert}`);
  console.log(`  UPDATE(기존 content.id 행 변경): ${toUpdate}`);
  console.log(`  무변경: ${desired.size - toInsert - toUpdate}`);
  console.log(`  desired content.id 행 총: ${desired.size}`);

  // 7. 유저별 watched 카운트 BEFORE vs AFTER + 단조성 ASSERT
  const beforeWatched = new Map<string, Set<string>>(); // user → distinct watched video_id
  for (const row of progress) {
    if (row.status !== "watched") continue;
    const set = beforeWatched.get(row.user_id) ?? new Set<string>();
    set.add(row.video_id);
    beforeWatched.set(row.user_id, set);
  }
  const afterWatched = new Map<string, Set<string>>(); // user → distinct watched content.id
  for (const want of desired.values()) {
    if (want.status !== "watched") continue;
    const set = afterWatched.get(want.user_id) ?? new Set<string>();
    set.add(want.video_id);
    afterWatched.set(want.user_id, set);
  }

  console.log("\n--- 유저별 watched 카운트 (BEFORE → AFTER) ---");
  const allUsers = new Set<string>([
    ...beforeWatched.keys(),
    ...afterWatched.keys(),
  ]);
  let regression = false;
  for (const userId of [...allUsers].sort()) {
    const before = beforeWatched.get(userId)?.size ?? 0;
    const after = afterWatched.get(userId)?.size ?? 0;
    const flag = after < before ? "  ❌ 감소!" : after > before ? "  ↑" : "";
    console.log(`  ${userId}: ${before} → ${after}${flag}`);
    if (after < before) regression = true;
  }
  console.log(`  유저 수: ${allUsers.size}`);

  if (regression) {
    console.error(
      "\n❌ 일부 유저의 watched 카운트가 감소합니다 (after < before). 중단합니다."
    );
    process.exit(1);
  }
  console.log("\n✅ 어떤 유저도 watched 카운트가 감소하지 않음 (after >= before).");

  // dry-run: 쓰기 없이 종료
  if (dryRun) {
    const afterCount = await countProgress();
    console.log(
      `\n🔎 --dry-run 완료 — 쓰기 없음. user_progress count: ${beforeCount} → ${afterCount} (${beforeCount === afterCount ? "변경 없음 확인" : "⚠️ 불일치"})`
    );
    return;
  }

  // === 실제 실행 (dry-run 아님) ===

  // 6a. 백업 먼저 (실패 시 중단)
  const allRows = await loadFullProgressForBackup();
  const backupDir = path.join(process.cwd(), "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const iso = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `user_progress_backup_${iso}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(allRows, null, 2), "utf-8");
  console.log(`\n💾 백업 저장: ${backupPath} (${allRows.length}행)`);

  // 6b. content.id 행 upsert (배치)
  console.log(`\n쓰기: content.id 행 ${upsertRows.length}개 upsert ...`);
  for (let i = 0; i < upsertRows.length; i += UPSERT_BATCH) {
    const batch = upsertRows.slice(i, i + UPSERT_BATCH);
    const { error } = await supabase
      .from("user_progress")
      .upsert(batch, { onConflict: "user_id,device_id,video_id" });
    if (error) throw new Error(`upsert 실패(batch ${i}): ${error.message}`);
  }

  const finalCount = await countProgress();
  console.log(
    `\n✅ 백필 완료. user_progress count: ${beforeCount} → ${finalCount} (레거시 행 보존됨).`
  );
}

/** 실제 실행 시 백업용 전체 행(select *) */
async function loadFullProgressForBackup(): Promise<unknown[]> {
  const rows: unknown[] = [];
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("user_progress")
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`백업 조회 실패: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

main().catch((err) => {
  console.error("백필 실패:", err);
  process.exit(1);
});
