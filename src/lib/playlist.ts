import { jsonStorage } from "./playlist.json";
import { supabaseStorage } from "./playlist.supabase";
import type { IPlaylistStorage } from "./storage";

export const storage: IPlaylistStorage =
  process.env.CATALOG_SOURCE === "supabase" ? supabaseStorage : jsonStorage;

export type { IPlaylistStorage };
