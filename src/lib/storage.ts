import { PlaylistData } from "@/types";

export type CategoryOverrideValue = "story" | "music" | "fesxlive" | "withxmeets" | "fesxrec" | null;

export interface IPlaylistStorage {
  getPlaylist(): Promise<PlaylistData>;
  toggleWatched(contentId: string): Promise<{ watched: boolean } | null>;
  setCategoryOverride(
    contentId: string,
    categoryOverride: CategoryOverrideValue | "auto"
  ): Promise<{ categoryOverride: CategoryOverrideValue } | null>;
}
