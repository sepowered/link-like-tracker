import { createClient } from "@supabase/supabase-js";
import { PlaylistData, ContentType } from "@/types";
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

function inferContentType(title: string): ContentType {
  const t = title.toLowerCase();
  if (t === "[private video]" || t === "[deleted video]") return "unavailable";
  if (/fesxrec/i.test(t)) return "fesxrec";
  if (/fesxlive|feslive|fes x live/i.test(t)) return "fesxlive";
  if (/with×meets|withxmeets/i.test(t)) return "withxmeets";
  return "music";
}

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
        // Wrap all videos in a single stub episode until DB migration is done
        episodes: [
          {
            id: `${s.id}-all`,
            episode_number: 0,
            title_ko: "전체",
            title_jp: "全部",
            contents: (s.videos ?? []).map((v) => ({
              id: v.id,
              type: inferContentType(v.title),
              title_ko: null,
              title_jp: v.title,
              part_label: null,
              legacy_video_id: v.id,
              watched: false,
              sources: [{ url: v.url, label: "원본" }],
              ...(v.category_override != null && { categoryOverride: v.category_override }),
            })),
          },
        ],
      })),
    };
  },

  async setCategoryOverride(
    contentId: string,
    categoryOverride: CategoryOverrideValue | "auto"
  ): Promise<{ categoryOverride: CategoryOverrideValue } | null> {
    const supabase = getClient();
    const value = categoryOverride === "auto" ? null : categoryOverride;

    const { data, error } = await supabase
      .from("videos")
      .update({ category_override: value })
      .eq("id", contentId)
      .select("id")
      .single();

    if (error || !data) return null;
    return { categoryOverride: value };
  },

  // watched 상태는 user_progress에서 관리 — 카탈로그 관심사 아님
  async toggleWatched(_contentId: string): Promise<{ watched: boolean } | null> {
    return { watched: false };
  },
};
