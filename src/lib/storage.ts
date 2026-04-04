import { PlaylistData } from "@/types";

export type CategoryOverrideValue = "story" | "music" | "fesxlive" | "withxmeets" | null;

export interface IPlaylistStorage {
  getPlaylist(): Promise<PlaylistData>;
  toggleWatched(videoId: string): Promise<{ watched: boolean } | null>;
  setCategoryOverride(
    videoId: string,
    categoryOverride: CategoryOverrideValue | "auto"
  ): Promise<{ categoryOverride: CategoryOverrideValue } | null>;
}
