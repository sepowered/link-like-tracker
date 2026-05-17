import fs from "fs/promises";
import path from "path";
import { PlaylistData } from "@/types";
import { IPlaylistStorage, CategoryOverrideValue } from "./storage";

const INITIAL_DATA_PATH = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "data",
  "playlist.initial.json"
);
const TMP_DATA_PATH = "/tmp/link-like-tracker-playlist.json";
const LOCAL_DATA_PATH = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "data",
  "playlist.json"
);

let dataPath = process.env.VERCEL ? TMP_DATA_PATH : LOCAL_DATA_PATH;

let ensurePlaylistFilePromise: Promise<void> | null = null;

let playlistCache:
  | {
      data: PlaylistData;
      modifiedAtMs: number;
    }
  | null = null;

function isPlaylistData(value: unknown): value is PlaylistData {
  if (!value || typeof value !== "object") return false;
  const { seasons } = value as { seasons?: unknown };
  if (!Array.isArray(seasons)) return false;

  return seasons.every((season) => {
    if (!season || typeof season !== "object") return false;
    const s = season as { id?: unknown; name?: unknown; episodes?: unknown };
    if (typeof s.id !== "string" || typeof s.name !== "string") return false;
    if (!Array.isArray(s.episodes)) return false;

    return s.episodes.every((ep) => {
      if (!ep || typeof ep !== "object") return false;
      const e = ep as {
        id?: unknown;
        episode_number?: unknown;
        contents?: unknown;
      };
      if (typeof e.id !== "string" || typeof e.episode_number !== "number") return false;
      if (!Array.isArray(e.contents)) return false;

      return e.contents.every((c) => {
        if (!c || typeof c !== "object") return false;
        const content = c as {
          id?: unknown;
          type?: unknown;
          legacy_video_id?: unknown;
          sources?: unknown;
        };
        return (
          typeof content.id === "string" &&
          typeof content.type === "string" &&
          typeof content.legacy_video_id === "string" &&
          Array.isArray(content.sources)
        );
      });
    });
  });
}

async function ensurePlaylistFile(): Promise<void> {
  if (!ensurePlaylistFilePromise) {
    ensurePlaylistFilePromise = (async () => {
      try {
        await fs.access(dataPath);
      } catch (error) {
        const missingFile =
          error instanceof Error && "code" in error && error.code === "ENOENT";

        if (!missingFile) {
          throw error;
        }

        const initialRaw = await fs.readFile(INITIAL_DATA_PATH, "utf-8");
        try {
          await fs.mkdir(path.dirname(dataPath), { recursive: true });
          await fs.writeFile(dataPath, initialRaw, "utf-8");
        } catch {
          dataPath = TMP_DATA_PATH;
          await fs.writeFile(dataPath, initialRaw, "utf-8");
        }
      }
    })();
  }

  await ensurePlaylistFilePromise;
}

async function readPlaylistData(): Promise<PlaylistData> {
  await ensurePlaylistFile();

  const stats = await fs.stat(dataPath);

  if (playlistCache && playlistCache.modifiedAtMs === stats.mtimeMs) {
    return playlistCache.data;
  }

  const raw = await fs.readFile(dataPath, "utf-8");
  const parsed: unknown = JSON.parse(raw);

  if (!isPlaylistData(parsed)) {
    throw new Error("Invalid playlist data shape");
  }

  playlistCache = {
    data: parsed,
    modifiedAtMs: stats.mtimeMs,
  };

  return parsed;
}

export const jsonStorage: IPlaylistStorage = {
  async getPlaylist(): Promise<PlaylistData> {
    return readPlaylistData();
  },

  async setCategoryOverride(
    contentId: string,
    categoryOverride: CategoryOverrideValue | "auto"
  ): Promise<{ categoryOverride: CategoryOverrideValue } | null> {
    const data = await readPlaylistData();
    let found = false;

    outer: for (const season of data.seasons) {
      for (const episode of season.episodes) {
        const content = episode.contents.find((c) => c.id === contentId);
        if (content) {
          if (categoryOverride === "auto") {
            delete content.categoryOverride;
          } else {
            content.categoryOverride = categoryOverride;
          }
          found = true;
          break outer;
        }
      }
    }

    if (!found) return null;

    await fs.writeFile(dataPath, JSON.stringify(data, null, 2), "utf-8");

    const stats = await fs.stat(dataPath);
    playlistCache = { data, modifiedAtMs: stats.mtimeMs };

    return { categoryOverride: categoryOverride === "auto" ? null : categoryOverride };
  },

  async toggleWatched(contentId: string): Promise<{ watched: boolean } | null> {
    const data = await readPlaylistData();
    let found = false;
    let newWatched = false;

    outer: for (const season of data.seasons) {
      for (const episode of season.episodes) {
        const content = episode.contents.find((c) => c.id === contentId);
        if (content) {
          content.watched = !content.watched;
          newWatched = content.watched;
          found = true;
          break outer;
        }
      }
    }

    if (!found) return null;

    await fs.writeFile(dataPath, JSON.stringify(data, null, 2), "utf-8");

    const stats = await fs.stat(dataPath);
    playlistCache = { data, modifiedAtMs: stats.mtimeMs };

    return { watched: newWatched };
  },
};
