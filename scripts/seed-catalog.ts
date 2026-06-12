/**
 * playlist.json (v2) → Supabase 카탈로그 시드 스크립트
 * seasons / episodes / contents / content_sources 를 FK 순서로 멱등 upsert.
 *
 * 실행: npx tsx --env-file .env.local scripts/seed-catalog.ts [--dry-run]
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import type { PlaylistData } from "@/types";
import { buildLegacyMap } from "@/lib/legacy-map";

// --- 골든 픽스처 (canonical, ordered) — §0 ground truth ---
const EXPECTED_SEASONS = 5;
const EXPECTED_EPISODES = 49;
const EXPECTED_CONTENTS = 517;
const EXPECTED_DISTINCT_LEGACY = 277;
const EXPECTED_SPLITS: Record<string, number> = {
  "3_bZr1vzepk": 5,
  "gP7f-YJWMgo": 5,
  // 103기 3·6·12화: 묶음 영상에 막간이 통째로 포함돼 있어 막간 단독
  // 콘텐츠(rvdurmx9Y88/fJ0wuKzXkxw/Jc7ZEeopqCE)가 같은 legacy 그룹에 속함
  "LHSnii0uk2g": 6, // Part 1~5 + 막간
  "UgYYPg3ziF0": 4,
  "5LqHE1E1YiU": 5,
  "jodiWtjQf9o": 7, // Part 1~6 + 막간
  "rF1Y5mCuf5M": 5,
  "Ptt3JMom-ac": 7,
  // 2026-06: 묶음(Part X~Y) story 분할 — blackdetect/silencedetect ×
  // 스토리채널 챕터 보정 × 타오구피 目次 댓글 교차 검증
  "B3Wn1z7RA78": 6,
  "nCPY9zQQzqM": 5,
  "KiZ2rza8Mm4": 4,
  "lLZl7VH9k8o": 5,
  "tWTffL80fI4": 3,
  "3kOADJ3yzKw": 5,
  "0nRfO_001xU": 3,
  "mQOVFYBlNXw": 6,
  "mzjd-Vt0i40": 3,
  "0N7-M47LafY": 4,
  "X1fnrf_Y2h8": 2,
  "qE7KoAvPmqg": 4,
  "jd-v40Ryu7s": 5,
  "imsTV6gexag": 4,
  "EMP7jXEW6hU": 4,
  "27pggt3-l6g": 5,
  // 2026-06: 105기 8~12화 원본 묶음 분할
  "y5uglKP3oyg": 4,
  "Si9-csGDOZ8": 5,
  "xmJr0Oj8318": 5,
  "cRmvAOi4xaE": 3,
  "flcUM4h8Mqs": 3,
  "3giw9ELMAE8": 2,
  "cdBweRBGYJc": 4,
  // 2026-06: 103기 9~16화 + 전환기 1~2화 / 104기 / 105기 CODA
  // 유튜브 디스크립션 챕터 및 目次 댓글 기반 묶음 story 분할
  "STwoyYEhnZg": 6,
  "PGMXfX8XVEY": 8,
  "iL49zf19neg": 9,
  "KbzsKgCchjE": 9, // Part 1~8 + 막간
  "7_s-cRi2wxY": 8,
  "wVVH0Ml-SP4": 9,
  "EEYt8ZqPCcI": 7,
  "ecrkNgZi81U": 3,
  "RhrWgN2dq7I": 9,
  "felsp-UlV5A": 10,
  "NPd8IYb3mpI": 12,
  "RhNVbdxdWTw": 6,
  "yL6osWcnUVg": 4,
  "Cp3cKjMv4GQ": 4,
  "4c3G0WrcFpE": 5,
  "8nKNaY02RGw": 3,
  "VGW0RDr3TXY": 5,
  "vabeRo8U1D4": 4,
  "4YNdIee5EfU": 3,
  "nVzysPwh2eA": 5,
  "_OHUwHThX6U": 8,
  "clHmKESdRLc": 9,
  "ilV91c19cvQ": 5,
  "2yu-_LmaU6g": 4,
  "sXvMkR8FCEM": 3,
};

const dryRun = process.argv.includes("--dry-run");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function loadPlaylist(): PlaylistData {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "data", "playlist.json"),
    "utf-8"
  );
  return JSON.parse(raw) as PlaylistData;
}

/** 모든 쓰기 전에 실행 — 불일치 시 비정상 종료 */
function assertGoldenFixture(data: PlaylistData): void {
  const seasonCount = data.seasons.length;
  const episodeCount = data.seasons.reduce((n, s) => n + s.episodes.length, 0);
  const contentCount = data.seasons.reduce(
    (n, s) => n + s.episodes.reduce((m, e) => m + e.contents.length, 0),
    0
  );

  const map = buildLegacyMap(data);
  const distinctLegacy = map.legacyToContentIds.size;

  const errors: string[] = [];
  if (seasonCount !== EXPECTED_SEASONS)
    errors.push(`seasons ${seasonCount} !== ${EXPECTED_SEASONS}`);
  if (episodeCount !== EXPECTED_EPISODES)
    errors.push(`episodes ${episodeCount} !== ${EXPECTED_EPISODES}`);
  if (contentCount !== EXPECTED_CONTENTS)
    errors.push(`contents ${contentCount} !== ${EXPECTED_CONTENTS}`);
  if (distinctLegacy !== EXPECTED_DISTINCT_LEGACY)
    errors.push(
      `distinct legacy_video_id ${distinctLegacy} !== ${EXPECTED_DISTINCT_LEGACY}`
    );

  for (const [legacyId, expectedSize] of Object.entries(EXPECTED_SPLITS)) {
    const actual = map.legacyToContentIds.get(legacyId);
    if (!actual) {
      errors.push(`split ${legacyId} missing`);
    } else if (actual.length !== expectedSize) {
      errors.push(`split ${legacyId} size ${actual.length} !== ${expectedSize}`);
    }
  }

  if (errors.length > 0) {
    console.error("❌ 골든 픽스처 불일치:");
    for (const e of errors) console.error(`   - ${e}`);
    process.exit(1);
  }

  console.log("✅ 골든 픽스처 통과");
  console.log(
    `   seasons=${seasonCount} episodes=${episodeCount} contents=${contentCount} distinctLegacy=${distinctLegacy}`
  );
}

async function seed(): Promise<void> {
  const data = loadPlaylist();
  assertGoldenFixture(data);

  // upsert 할 행 빌드 (sort_order = 각 레벨의 배열 인덱스)
  const seasonRows = data.seasons.map((s, si) => ({
    id: s.id,
    name: s.name,
    sort_order: si,
  }));

  const episodeRows: {
    id: string;
    season_id: string;
    episode_number: number;
    title_ko: string | null;
    title_jp: string | null;
    sort_order: number;
  }[] = [];
  const contentRows: {
    id: string;
    episode_id: string;
    type: string;
    title_ko: string | null;
    title_jp: string | null;
    part_label: string | null;
    legacy_video_id: string;
    sort_order: number;
    category_override: string | null;
  }[] = [];
  const sourceRows: {
    content_id: string;
    url: string;
    label: string | null;
    timestamp_todo: boolean;
    sort_order: number;
  }[] = [];

  const perSeasonCounts: { name: string; episodes: number; contents: number }[] =
    [];

  for (const season of data.seasons) {
    let seasonContentCount = 0;
    for (const [ei, episode] of season.episodes.entries()) {
      episodeRows.push({
        id: episode.id,
        season_id: season.id,
        episode_number: episode.episode_number,
        title_ko: episode.title_ko ?? null,
        title_jp: episode.title_jp ?? null,
        sort_order: ei,
      });

      for (const [ci, content] of episode.contents.entries()) {
        contentRows.push({
          id: content.id,
          episode_id: episode.id,
          type: content.type,
          title_ko: content.title_ko ?? null,
          title_jp: content.title_jp ?? null,
          part_label: content.part_label ?? null,
          legacy_video_id: content.legacy_video_id,
          sort_order: ci,
          category_override: content.categoryOverride ?? null,
        });

        for (const [si, src] of content.sources.entries()) {
          sourceRows.push({
            content_id: content.id,
            url: src.url,
            label: src.label ?? null,
            timestamp_todo: src.timestamp_todo ?? false,
            sort_order: si,
          });
        }
        seasonContentCount += 1;
      }
    }
    perSeasonCounts.push({
      name: season.name,
      episodes: season.episodes.length,
      contents: seasonContentCount,
    });
  }

  if (dryRun) {
    console.log("\n🔎 --dry-run — 쓰기 없음. 삽입될 행 수:");
    console.log(`   seasons:         ${seasonRows.length}`);
    console.log(`   episodes:        ${episodeRows.length}`);
    console.log(`   contents:        ${contentRows.length}`);
    console.log(`   content_sources: ${sourceRows.length}`);
    for (const c of perSeasonCounts) {
      console.log(`   - ${c.name}: ep=${c.episodes} contents=${c.contents}`);
    }
    return;
  }

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 누락");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // FK 순서: seasons → episodes → contents → content_sources
  const { error: sErr } = await supabase
    .from("seasons")
    .upsert(seasonRows, { onConflict: "id" });
  if (sErr) throw new Error(`seasons: ${sErr.message}`);

  const { error: eErr } = await supabase
    .from("episodes")
    .upsert(episodeRows, { onConflict: "id" });
  if (eErr) throw new Error(`episodes: ${eErr.message}`);

  const { error: cErr } = await supabase
    .from("contents")
    .upsert(contentRows, { onConflict: "id" });
  if (cErr) throw new Error(`contents: ${cErr.message}`);

  const { error: srcErr } = await supabase
    .from("content_sources")
    .upsert(sourceRows, { onConflict: "content_id,sort_order" });
  if (srcErr) throw new Error(`content_sources: ${srcErr.message}`);

  for (const c of perSeasonCounts) {
    console.log(`  ${c.name}: ep=${c.episodes} contents=${c.contents}`);
  }

  // DB-vs-JSON 카운트 검증
  const { count: dbContents, error: ccErr } = await supabase
    .from("contents")
    .select("*", { count: "exact", head: true });
  if (ccErr) throw ccErr;

  console.log(`\n✅ 시드 완료`);
  console.log(`   JSON contents 수: ${contentRows.length}`);
  console.log(`   DB   contents 수: ${dbContents}`);
  if (dbContents !== contentRows.length) {
    console.warn("⚠️  카운트 불일치 — DB에 이전 항목이 남아있을 수 있습니다");
  }
}

seed().catch((err) => {
  console.error("시드 실패:", err);
  process.exit(1);
});
