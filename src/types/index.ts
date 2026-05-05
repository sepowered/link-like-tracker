export interface Video {
  id: string;
  title: string;
  url: string;
  watched: boolean;
  categoryOverride?: "story" | "music" | "fesxlive" | "withxmeets" | "fesxrec" | null;
}

export interface Season {
  id: string;
  name: string;
  videos: Video[];
}

export interface PlaylistData {
  seasons: Season[];
}
