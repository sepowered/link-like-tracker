/**
 * playlist.json → playlist.v2.draft.json 변환 스크립트
 *
 * 실행: npx tsx scripts/generate-v2-draft.ts
 *
 * - 에피소드(장) 단위로 콘텐츠를 그룹핑
 * - 위키 기준 title_ko / title_jp 할당
 * - 타임스탬프가 필요한 멀티파트 항목은 timestamp_todo: true 표시
 */

import fs from "fs";
import path from "path";

// ─── 위키 에피소드 타이틀 ──────────────────────────────────────────────────

const WIKI: Record<string, Array<{ ko: string; jp: string }>> = {
  "103-main": [
    { ko: "꽃피우고싶어!", jp: "花咲きたい！" },
    { ko: "엉망진창-세계!?", jp: "ダメダメ⇒世界一！？" },
    { ko: "비와, 바람과, 태양과", jp: "雨と、風と、太陽と" },
    { ko: "나의 스쿨아이돌", jp: "わたしのスクールアイドル" },
    { ko: "고개를 들고", jp: "顔を上げて" },
    { ko: "제멋대로 on the ICE!!", jp: "わがまま on the ICE!!" },
    { ko: "선배와 후배", jp: "センパイとコウハイ" },
    { ko: "그날의 마음, 내일의 마음", jp: "あの日のこころ、明日のこころ" },
    { ko: "루리, 이스케이프!", jp: "ルリ・エスケープ" },
    { ko: "루리메구 팡파레", jp: "ルリめぐ・ファンファーレ" },
    { ko: "스쿨아이돌 클럽을 위해서(?)", jp: "スクールアイドルクラブのために！（？）" },
    { ko: "기대가 크다!", jp: "期待はおもい！" },
    { ko: "따라잡았어", jp: "追いついたよ" },
    { ko: "Link! Like!", jp: "Link！Like！" },
    { ko: "꿈을 믿는 이야기", jp: "夢を信じる物語" },
    { ko: "Special Thanks", jp: "Special Thanks" },
  ],
  "103-trans": [
    { ko: "루리 생각해", jp: "ルリ思う。" },
    { ko: "언젠가 만날 네번째 벚꽃", jp: "いずれ会う四度目の桜" },
  ],
  "104-main": [
    { ko: "미래로의 노래", jp: "未来への歌" },
    { ko: "계속 춤추자, 네가 보고있어", jp: "踊り続けよう、きみが見てる" },
    { ko: "고로 미라쿠라파크는 존재한다", jp: "ゆえに、みらくらぱーく！あり" },
    { ko: "예나 지금이나 같은 하늘 아래에서", jp: "昔もいまも、同じ空の下" },
    { ko: "불완전한, 미완성", jp: "不完全で、未完成" },
    { ko: "대련 환영!!", jp: "対よろ！！！" },
    { ko: "Link to the FRIENDS!", jp: "Link to the FRIENDS！" },
    { ko: "Not a marionette", jp: "Not a marionette" },
    { ko: "미라쿠라 더 유니버스!", jp: "みらくる・ざ・ゆにばーす！" },
    { ko: "Believe your love. Believe your live", jp: "Believe your love. Believe your live" },
    { ko: "꿈을 피우는 이야기", jp: "夢を咲かせる物語" },
    { ko: "내일의 너에게 꽃다발을", jp: "明日の君に花束を" },
    { ko: "언젠가 만날 약속의 벚꽃", jp: "いずれ会う約束の桜" },
  ],
  "105-main": [
    { ko: "A NEW STORY!!!!!!+", jp: "A NEW STORY!!!!!!+" },
    { ko: "Dream Match!", jp: "Dream Match！" },
    { ko: "별을 동경하며, 꽃은 춤추고", jp: "星に憧れて、花は舞う" },
    { ko: "태양을 향한 등", jp: "太陽を目指した背中" },
    { ko: "잠자는 바다의 공주님!", jp: "眠れる海のお姫様！" },
    { ko: "미래로의 꽃", jp: "未来への花" },
    { ko: "제멋대로 색의 존재증명", jp: "わがまま色の存在証明" },
    { ko: "지금은 아직 아득히 희미한 빛", jp: "今はまだ遥か幽かな光" },
    { ko: "ALL Link to YOU", jp: "ALL Link to YOU" },
    { ko: "고로, 루리 있다.", jp: "ゆえに、ルリあり。" },
    { ko: "모두 함께, 꽃피우고싶어!", jp: "みんなで、花咲きたい！" },
    { ko: "영원히 꽃피는 우리의 벚꽃", jp: "ずっと花咲く僕らの桜" },
  ],
};

// ─── 타입 ─────────────────────────────────────────────────────────────────

type ContentType = "story" | "fesxlive" | "fesxrec" | "music" | "withxmeets" | "special" | "unavailable";

interface Source {
  url: string;
  label: string;
  timestamp_todo?: boolean;
}

interface ContentDraft {
  id: string;
  type: ContentType;
  title_ko: string | null;
  title_jp: string | null;
  part_label: string | null;
  legacy_video_id: string;
  sources: Source[];
}

interface EpisodeDraft {
  id: string;
  episode_number: number;
  title_ko: string;
  title_jp: string;
  contents: ContentDraft[];
}

interface SeasonDraft {
  id: string;
  name: string;
  episodes: EpisodeDraft[];
}

interface PlaylistV2Draft {
  _note: string;
  _generated_at: string;
  seasons: SeasonDraft[];
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────

function detectContentType(title: string): ContentType {
  if (title === "[Private video]" || title === "[Deleted video]") return "unavailable";
  if (/FesxLIVE|FesLIVE|Fes蓮ノ空|FesxREC|페스라이브/i.test(title)) {
    if (/REC|FesxREC/i.test(title)) return "fesxrec";
    return "fesxlive";
  }
  if (/With×MEETS|WithMEETS|배신|配信/i.test(title)) return "withxmeets";
  if (/リリックビデオ|Lyric Video|가사자막|ライブビデオ|Live Video|MV|뮤직비디오/i.test(title)) return "music";
  return "music"; // 기본값: 스토리 에피소드가 아닌 나머지는 music/special
}

function extractPartLabel(title: string): string | null {
  const partMatch = title.match(/Part\s*([\d~\-]+)|전편|후편|전반|후반|막간|엔딩|ED|ABYSS|S\.R\.K\..*|BD/i);
  return partMatch ? partMatch[0] : null;
}

// 에피소드 번호 추출
function detectEpisodeNumber(title: string, seasonId: string): number | null {
  if (seasonId === "103-main") {
    const m = title.match(/(\d+)장/);
    return m ? parseInt(m[1]) : null;
  }
  if (seasonId === "103-trans") {
    if (/17장|루리 생각해/.test(title)) return 1;
    if (/18장|네번째 벚꽃/.test(title)) return 2;
    return null;
  }
  if (seasonId === "104-main") {
    // [자막] 하스노소라 104기 N장
    const m1 = title.match(/104기\s*(\d+)장/);
    if (m1) return parseInt(m1[1]);
    // 링크라 활동기록 제 N화
    const m2 = title.match(/제\s*(\d+)화/);
    if (m2) return parseInt(m2[1]);
    return null;
  }
  if (seasonId === "105-main") {
    // [자막] ... 105기 제N화
    const m1 = title.match(/제(\d+)화/);
    if (m1) return parseInt(m1[1]);
    // "Link! Like! Love Live!" ... Episode N
    const m2 = title.match(/Episode\s*(\d+)/i);
    if (m2) return parseInt(m2[1]);
    // 第N話
    const m3 = title.match(/第(\d+)話/);
    if (m3) return parseInt(m3[1]);
    // January 2026 Episode N
    const m4 = title.match(/2026年\S+・第(\d+)話/);
    if (m4) return parseInt(m4[1]);
    return null;
  }
  return null;
}

function isStoryContent(title: string, seasonId: string): boolean {
  if (seasonId === "103-main" || seasonId === "103-trans") {
    return /\[자막\].*장/.test(title);
  }
  if (seasonId === "104-main") {
    return /\[자막\].*104기.*장|링크라 활동기록|하스노소라 활동기록.*104기/.test(title);
  }
  if (seasonId === "105-main") {
    return /\[자막\].*105기.*제\d+화|Link! Like! Love Live!.*Episode|第\d+話|2026年.*第\d+話/.test(title);
  }
  return false;
}

function detectSourceLabel(title: string): string {
  if (/\[자막\]|자막/.test(title) && !/\[가사자막\]/.test(title)) return "자막본";
  if (/Link! Like! Love Live!/.test(title)) return "영문자막";
  if (/第\d+話|2025年|2026年/.test(title)) return "원본";
  return "원본";
}

// ─── 메인 그룹핑 로직 ────────────────────────────────────────────────────

interface Video {
  id: string;
  title: string;
  url: string;
  watched: boolean;
  categoryOverride?: string | null;
}

function groupVideosByEpisode(videos: Video[], seasonId: string): EpisodeDraft[] {
  const wikiTitles = WIKI[seasonId] ?? [];
  const episodes: EpisodeDraft[] = [];
  let currentEpisode: EpisodeDraft | null = null;
  let preEpisodeBuffer: Video[] = [];
  let episodeCounter = 0;

  // 프롤로그 에피소드 (에피소드 마커 이전 콘텐츠용)
  const prologue: EpisodeDraft = {
    id: `${seasonId}-prologue`,
    episode_number: 0,
    title_ko: "프롤로그",
    title_jp: "プロローグ",
    contents: [],
  };

  for (const video of videos) {
    const epNum = detectEpisodeNumber(video.title, seasonId);
    const isStory = isStoryContent(video.title, seasonId);

    if (isStory && epNum !== null) {
      // 새 에피소드 시작
      if (currentEpisode === null || currentEpisode.episode_number !== epNum) {
        // 프롤로그 버퍼 처리
        if (currentEpisode === null && preEpisodeBuffer.length > 0) {
          for (const v of preEpisodeBuffer) {
            prologue.contents.push(makeNonStoryContent(v, seasonId));
          }
          preEpisodeBuffer = [];
        }

        const wiki: { ko: string; jp: string } | undefined = wikiTitles[epNum - 1];
        currentEpisode = {
          id: `${seasonId}-ep-${String(epNum).padStart(3, "0")}`,
          episode_number: epNum,
          title_ko: wiki?.ko ?? `${epNum}화`,
          title_jp: wiki?.jp ?? `第${epNum}話`,
          contents: [],
        };
        episodes.push(currentEpisode);
        episodeCounter++;
      }

      // 스토리 콘텐츠 추가
      const partLabel = extractPartLabel(video.title);
      const isMultiPart = /Part\s*\d+[~\-]\d+/i.test(video.title);
      currentEpisode.contents.push({
        id: video.id,
        type: "story",
        title_ko: null,
        title_jp: null,
        part_label: partLabel,
        legacy_video_id: video.id,
        sources: [
          {
            url: `${video.url}${isMultiPart ? "&t=0s" : ""}`,
            label: detectSourceLabel(video.title),
            ...(isMultiPart ? { timestamp_todo: true } : {}),
          },
        ],
      });
    } else {
      // 비스토리 콘텐츠
      if (currentEpisode === null) {
        preEpisodeBuffer.push(video);
      } else {
        currentEpisode.contents.push(makeNonStoryContent(video, seasonId));
      }
    }
  }

  // 프롤로그에 버퍼 남은 것 처리
  if (preEpisodeBuffer.length > 0) {
    for (const v of preEpisodeBuffer) {
      prologue.contents.push(makeNonStoryContent(v, seasonId));
    }
  }

  if (prologue.contents.length > 0) {
    return [prologue, ...episodes];
  }

  return episodes;
}

function makeNonStoryContent(video: Video, _seasonId: string): ContentDraft {
  const type = detectContentType(video.title);
  return {
    id: video.id,
    type,
    title_ko: null,
    title_jp: video.title,
    part_label: null,
    legacy_video_id: video.id,
    sources: [
      {
        url: video.url,
        label: "원본",
      },
    ],
  };
}

// ─── 실행 ──────────────────────────────────────────────────────────────────

const raw = fs.readFileSync(path.join(process.cwd(), "data", "playlist.json"), "utf-8");
const playlist: { seasons: Array<{ id: string; name: string; videos: Video[] }> } = JSON.parse(raw);

const output: PlaylistV2Draft = {
  _note: "자동 생성 초안 — timestamp_todo: true 항목은 수동으로 타임스탬프 입력 필요",
  _generated_at: new Date().toISOString(),
  seasons: playlist.seasons.map((season) => ({
    id: season.id,
    name: season.name,
    episodes: groupVideosByEpisode(season.videos, season.id),
  })),
};

// 통계 출력
let totalEpisodes = 0;
let totalContents = 0;
let todoCount = 0;

for (const season of output.seasons) {
  console.log(`\n=== ${season.name} ===`);
  for (const ep of season.episodes) {
    console.log(`  ${ep.id} — ${ep.title_ko} (콘텐츠 ${ep.contents.length}개)`);
    totalEpisodes++;
    for (const c of ep.contents) {
      totalContents++;
      for (const s of c.sources) {
        if (s.timestamp_todo) {
          todoCount++;
          console.log(`    ⚠️  timestamp_todo: ${c.id} (${c.part_label})`);
        }
      }
    }
  }
}

console.log(`\n✅ 총 에피소드: ${totalEpisodes}, 총 콘텐츠: ${totalContents}`);
console.log(`⚠️  타임스탬프 수동 입력 필요: ${todoCount}개`);

const outPath = path.join(process.cwd(), "data", "playlist.v2.draft.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");
console.log(`\n📄 저장: ${outPath}`);
