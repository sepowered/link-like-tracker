export type VideoCategory = "all" | "story" | "music" | "fesxlive" | "fesxrec" | "withxmeets";

const STORY_PATTERNS = [
  /링크라 활동기록/u,
  /link! like! lovelive!/u,
  /제\s*\d+화/u,
  /第\s*\d+話/u,
  /episode\s*\d+/u,
  /(^|\s)\d+장(?=\s|$)/u,
];

const MUSIC_PATTERNS = [
  /lyric video/u,
  /ライブビデオ/u,
  /リリックビデオ/u,
  /리릭비디오/u,
  /オープニング映像/u,
  /오프닝 영상/u,
  /ending theme/u,
  /(^|[^a-z])ed($|[^a-z])/u,
];

const FESXLIVE_PATTERNS = [
  /fesxlive/u,
  /fes x live/u,
  /feslive/u,
];

const FESXREC_PATTERNS = [
  /fesxrec/u,
];

export function classifyVideoCategory(title: string): Exclude<VideoCategory, "all"> | null {
  const normalized = title.toLowerCase();

  if (
    normalized.includes("with×meets") ||
    normalized.includes("withxmeets") ||
    normalized.includes("with× meets")
  ) {
    return "withxmeets";
  }

  if (FESXLIVE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "fesxlive";
  }

  if (STORY_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "story";
  }

  if (MUSIC_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "music";
  }

  if (FESXREC_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "fesxrec";
  }

  return null;
}

export function getVideoCategoryLabel(category: Exclude<VideoCategory, "all"> | null) {
  switch (category) {
    case "story":
      return "스토리";
    case "music":
      return "음악";
    case "fesxlive":
      return "FesxLIVE";
    case "fesxrec":
      return "FesxReC";
    case "withxmeets":
      return "With×MEETS";
    default:
      return "미분류";
  }
}
