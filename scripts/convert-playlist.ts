import fs from "fs";
import path from "path";

interface Video {
  id: string;
  title: string;
  url: string;
  watched: boolean;
}

interface Season {
  id: string;
  name: string;
  videos: Video[];
}

interface PlaylistData {
  seasons: Season[];
}

// playlist.md 파싱
const mdPath = path.join(process.cwd(), "playlist.md");
const mdContent = fs.readFileSync(mdPath, "utf-8");

const lines = mdContent.split("\n");
const videos: Array<{ index: number; video: Video }> = [];

for (const line of lines) {
  // 패턴: "N. [제목](url)"
  const match = line.match(/^(\d+)\.\s+\[(.+?)\]\((https?:\/\/[^\)]+)\)/);
  if (!match) continue;

  const [, indexStr, title, url] = match;
  const index = parseInt(indexStr, 10);

  // YouTube video ID 추출
  const videoIdMatch = url.match(/[?&]v=([^&]+)/);
  const id = videoIdMatch ? videoIdMatch[1] : `video-${index}`;

  videos.push({
    index,
    video: {
      id,
      title: title.trim(),
      url,
      watched: false,
    },
  });
}

// 시즌 분류 함수
function classifySeason(index: number, title: string): string {
  const t = title.toLowerCase();

  // 105기 패턴
  if (
    t.includes("105기") ||
    t.includes("105期") ||
    t.includes("105기") ||
    index >= 191
  ) {
    return "105-main";
  }

  // 104기 패턴 (item 93부터)
  if (
    t.includes("104기") ||
    t.includes("104期") ||
    t.includes("104기") ||
    index >= 93
  ) {
    return "104-main";
  }

  // 103기 전환기 (68~92)
  if (index >= 68) {
    return "103-trans";
  }

  // 103기 본편 (1~67)
  return "103-main";
}

const seasonDefs: Record<string, { id: string; name: string }> = {
  "103-main": { id: "103-main", name: "103기 본편" },
  "103-trans": { id: "103-trans", name: "103기 전환기" },
  "104-main": { id: "104-main", name: "104기" },
  "105-main": { id: "105-main", name: "105기" },
};

// 시즌별 분류 (Private video: position-based inheritance)
const seasonMap: Record<string, Video[]> = {
  "103-main": [],
  "103-trans": [],
  "104-main": [],
  "105-main": [],
};

let lastSeasonId = "103-main";

for (const { index, video } of videos) {
  const isPrivate = video.title === "[Private video]";

  if (!isPrivate) {
    const seasonId = classifySeason(index, video.title);
    lastSeasonId = seasonId;
    seasonMap[seasonId].push(video);
  } else {
    // Private video: 직전 비-Private 항목의 시즌 상속
    seasonMap[lastSeasonId].push(video);
  }
}

// PlaylistData 구조 생성
const playlistData: PlaylistData = {
  seasons: Object.entries(seasonDefs).map(([id, def]) => ({
    id: def.id,
    name: def.name,
    videos: seasonMap[id],
  })),
};

// data 디렉토리 생성
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// JSON 저장
const outputPath = path.join(dataDir, "playlist.json");
fs.writeFileSync(outputPath, JSON.stringify(playlistData, null, 2), "utf-8");

// 통계 출력
const totalVideos = videos.length;
console.log(`✅ 변환 완료: ${outputPath}`);
console.log(`총 ${totalVideos}개 항목`);
for (const [id, vids] of Object.entries(seasonMap)) {
  const privateCount = vids.filter((v) => v.title === "[Private video]").length;
  console.log(
    `  ${seasonDefs[id].name}: ${vids.length}개 (Private: ${privateCount}개)`
  );
}
