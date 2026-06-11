import { createClient } from "@supabase/supabase-js";
import { PlaylistData, ContentType, ContentSource } from "@/types";
import { IPlaylistStorage, CategoryOverrideValue } from "./storage";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type ContentSourceRow = {
  url: string;
  label: string | null;
  timestamp_todo: boolean;
  sort_order: number;
};

type ContentRow = {
  id: string;
  episode_id: string;
  type: ContentType;
  title_ko: string | null;
  title_jp: string | null;
  part_label: string | null;
  legacy_video_id: string;
  sort_order: number;
  category_override: CategoryOverrideValue;
  content_sources: ContentSourceRow[];
};

type EpisodeRow = {
  id: string;
  season_id: string;
  episode_number: number;
  title_ko: string | null;
  title_jp: string | null;
  sort_order: number;
  contents: ContentRow[];
};

type SeasonRow = {
  id: string;
  name: string;
  sort_order: number;
  episodes: EpisodeRow[];
};

export const supabaseStorage: IPlaylistStorage = {
  async getPlaylist(): Promise<PlaylistData> {
    const supabase = getClient();

    const { data, error } = await supabase
      .from("seasons")
      .select(
        "id, name, sort_order, " +
          "episodes(id, season_id, episode_number, title_ko, title_jp, sort_order, " +
          "contents(id, episode_id, type, title_ko, title_jp, part_label, legacy_video_id, sort_order, category_override, " +
          "content_sources(url, label, timestamp_todo, sort_order)))"
      )
      .returns<SeasonRow[]>();

    if (error) throw error;

    // 3단계 중첩 정렬은 PostgREST에서 까다로우므로 JS에서 결정론적으로 정렬
    const seasons = [...(data ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({
        id: s.id,
        name: s.name,
        episodes: [...(s.episodes ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((e) => ({
            id: e.id,
            episode_number: e.episode_number,
            title_ko: e.title_ko ?? "",
            title_jp: e.title_jp ?? "",
            contents: [...(e.contents ?? [])]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((c) => {
                const sources: ContentSource[] = [...(c.content_sources ?? [])]
                  .sort((x, y) => x.sort_order - y.sort_order)
                  .map((src) => ({
                    url: src.url,
                    label: src.label ?? "",
                    ...(src.timestamp_todo && { timestamp_todo: true }),
                  }));

                return {
                  id: c.id,
                  type: c.type,
                  title_ko: c.title_ko,
                  title_jp: c.title_jp,
                  part_label: c.part_label,
                  legacy_video_id: c.legacy_video_id,
                  watched: false,
                  sources,
                  ...(c.category_override != null && {
                    categoryOverride: c.category_override,
                  }),
                };
              }),
          })),
      }));

    return { seasons };
  },

  async setCategoryOverride(
    contentId: string,
    categoryOverride: CategoryOverrideValue | "auto"
  ): Promise<{ categoryOverride: CategoryOverrideValue } | null> {
    const supabase = getClient();
    const value = categoryOverride === "auto" ? null : categoryOverride;

    const { data, error } = await supabase
      .from("contents")
      .update({ category_override: value })
      .eq("id", contentId)
      .select("id")
      .single();

    if (error || !data) return null;
    return { categoryOverride: value };
  },

  // watched 상태는 user_progress에서 관리 — 카탈로그 관심사 아님
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stub implementation; param kept for interface compatibility
  async toggleWatched(_contentId: string): Promise<{ watched: boolean } | null> {
    return { watched: false };
  },
};
