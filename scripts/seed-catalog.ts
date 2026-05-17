/**
 * playlist.json → Supabase seasons/videos 시드 스크립트
 *
 * 실행: npx tsx --env-file .env.local scripts/seed-catalog.ts
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 누락");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

interface Video {
  id: string;
  title: string;
  url: string;
  watched: boolean;
  categoryOverride?: string | null;
}

interface Season {
  id: string;
  name: string;
  videos: Video[];
}

const raw = fs.readFileSync(
  path.join(process.cwd(), "data", "playlist.json"),
  "utf-8"
);
const { seasons }: { seasons: Season[] } = JSON.parse(raw);

async function seed() {
  let totalVideos = 0;

  for (const [i, season] of seasons.entries()) {
    const { error: sErr } = await supabase.from("seasons").upsert({
      id: season.id,
      name: season.name,
      sort_order: i,
    });
    if (sErr) throw new Error(`season ${season.id}: ${sErr.message}`);

    const videoRows = season.videos.map((v, j) => ({
      id: v.id,
      season_id: season.id,
      title: v.title,
      url: v.url,
      sort_order: j,
      category_override: v.categoryOverride ?? null,
    }));

    const { error: vErr } = await supabase.from("videos").upsert(videoRows);
    if (vErr) throw new Error(`videos for ${season.id}: ${vErr.message}`);

    totalVideos += videoRows.length;
    console.log(`  ${season.name}: ${videoRows.length}개`);
  }

  // 검증: DB 카운트와 JSON 카운트 비교
  const { count, error: cErr } = await supabase
    .from("videos")
    .select("*", { count: "exact", head: true });
  if (cErr) throw cErr;

  console.log(`\n✅ 시드 완료`);
  console.log(`   JSON 비디오 수: ${totalVideos}`);
  console.log(`   DB  비디오 수: ${count}`);

  if (count !== totalVideos) {
    console.warn("⚠️  카운트 불일치 — DB에 이전 항목이 남아있을 수 있습니다");
  }
}

seed().catch((err) => {
  console.error("시드 실패:", err);
  process.exit(1);
});
