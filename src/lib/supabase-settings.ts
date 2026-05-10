import type { SupabaseClient } from "@supabase/supabase-js";
import type { VideoCategory } from "./video-category";

export interface SyncedSettings {
  progressCategories: VideoCategory[];
  hidePrivateVideos: boolean;
  autoSync: boolean;
}

export interface RemoteSettingsRow {
  progress_categories: VideoCategory[];
  hide_private_videos: boolean;
  auto_sync: boolean;
  updated_at: string;
}

const VALID_PROGRESS_CATEGORIES = new Set<VideoCategory>([
  "story",
  "music",
  "fesxlive",
  "fesxrec",
  "withxmeets",
]);

function normalizeProgressCategories(categories: unknown): VideoCategory[] {
  if (!Array.isArray(categories)) return [];

  return categories.filter((category): category is VideoCategory =>
    VALID_PROGRESS_CATEGORIES.has(category as VideoCategory),
  );
}

export function remoteSettingsToSettings(row: RemoteSettingsRow): SyncedSettings {
  return {
    progressCategories: normalizeProgressCategories(row.progress_categories),
    hidePrivateVideos: row.hide_private_videos,
    autoSync: row.auto_sync,
  };
}

export async function downloadSettings(
  supabase: SupabaseClient,
  userId: string,
): Promise<SyncedSettings | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("progress_categories, hide_private_videos, auto_sync, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`downloadSettings: ${error.message}`);
  if (!data) return null;

  return remoteSettingsToSettings(data as RemoteSettingsRow);
}

export async function uploadSettings(
  supabase: SupabaseClient,
  userId: string,
  settings: SyncedSettings,
): Promise<void> {
  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      progress_categories: normalizeProgressCategories(settings.progressCategories),
      hide_private_videos: settings.hidePrivateVideos,
      auto_sync: settings.autoSync,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw new Error(`uploadSettings: ${error.message}`);
}
