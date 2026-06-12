export type CategoryOverrideValue = "story" | "music" | "fesxlive" | "withxmeets" | "fesxrec" | null;
export type ContentType = "story" | "fesxlive" | "fesxrec" | "music" | "withxmeets" | "special" | "unavailable";

export interface ContentSource {
  url: string;
  label: string;
  timestamp_todo?: boolean;
}

export interface Content {
  id: string;
  type: ContentType;
  title_ko: string | null;
  title_jp: string | null;
  part_label: string | null;
  legacy_video_id: string;
  watched: boolean;
  categoryOverride?: CategoryOverrideValue;
  sources: ContentSource[];
}

export interface Episode {
  id: string;
  episode_number: number;
  title_ko: string;
  title_jp: string;
  contents: Content[];
}

export interface Season {
  id: string;
  name: string;
  episodes: Episode[];
}

export interface PlaylistData {
  seasons: Season[];
}
