import { createClient } from "@supabase/supabase-js";
import { PlaylistData } from "@/types";
import { IPlaylistStorage, CategoryOverrideValue } from "./storage";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type VideoRow = {
  id: string;
  title: string;
  url: string;
  sort_order: number;
  category_override: CategoryOverrideValue;
};

type SeasonRow = {
  id: string;
  name: string;
  sort_order: number;
  videos: VideoRow[];
};

export const supabaseStorage: IPlaylistStorage = {
  async getPlaylist(): Promise<PlaylistData> {
    const supabase = getClient();

    const { data, error } = await supabase
      .from("seasons")
      .select("id, name, sort_order, videos(id, title, url, sort_order, category_override)")
      .order("sort_order", { ascending: true })
      .order("sort_order", { ascending: true, referencedTable: "videos" })
      .returns<SeasonRow[]>();

    if (error) throw error;

    return {
      seasons: (data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        videos: (s.videos ?? []).map((v) => ({
          id: v.id,
          title: v.title,
          url: v.url,
          watched: false,
          ...(v.category_override != null && { categoryOverride: v.category_override }),
        })),
      })),
    };
  },

  async setCategoryOverride(
    videoId: string,
    categoryOverride: CategoryOverrideValue | "auto"
  ): Promise<{ categoryOverride: CategoryOverrideValue } | null> {
    const supabase = getClient();
    const value = categoryOverride === "auto" ? null : categoryOverride;

    const { data, error } = await supabase
      .from("videos")
      .update({ category_override: value })
      .eq("id", videoId)
      .select("id")
      .single();

    if (error || !data) return null;
    return { categoryOverride: value };
  },

  // watched 상태는 user_progress에서 관리 — 카탈로그 관심사 아님
  async toggleWatched(_videoId: string): Promise<{ watched: boolean } | null> {
    return { watched: false };
  },
};
