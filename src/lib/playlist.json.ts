import fs from "fs/promises";
import path from "path";
import { PlaylistData } from "@/types";
import { IPlaylistStorage, CategoryOverrideValue } from "./storage";

const DATA_PATH = path.join(process.cwd(), "data", "playlist.json");
const INITIAL_DATA_PATH = path.join(process.cwd(), "data", "playlist.initial.json");

let ensurePlaylistFilePromise: Promise<void> | null = null;

let playlistCache:
  | {
      data: PlaylistData;
      modifiedAtMs: number;
    }
  | null = null;

function isPlaylistData(value: unknown): value is PlaylistData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const { seasons } = value as { seasons?: unknown };

  return (
    Array.isArray(seasons) &&
    seasons.every((season) => {
      if (!season || typeof season !== "object") {
        return false;
      }

      const seasonRecord = season as {
        id?: unknown;
        name?: unknown;
        videos?: unknown;
      };

      return (
        typeof seasonRecord.id === "string" &&
        typeof seasonRecord.name === "string" &&
        Array.isArray(seasonRecord.videos) &&
        seasonRecord.videos.every((video) => {
          if (!video || typeof video !== "object") {
            return false;
          }

          const videoRecord = video as {
            id?: unknown;
            title?: unknown;
            url?: unknown;
            watched?: unknown;
            categoryOverride?: unknown;
          };

          const validCategoryValues = ["story", "music", "fesxlive", "withxmeets"];
          const validCategoryOverride =
            !("categoryOverride" in videoRecord) ||
            videoRecord.categoryOverride === null ||
            (typeof videoRecord.categoryOverride === "string" &&
              validCategoryValues.includes(videoRecord.categoryOverride));

          return (
            typeof videoRecord.id === "string" &&
            typeof videoRecord.title === "string" &&
            typeof videoRecord.url === "string" &&
            typeof videoRecord.watched === "boolean" &&
            validCategoryOverride
          );
        })
      );
    })
  );
}

async function ensurePlaylistFile(): Promise<void> {
  if (!ensurePlaylistFilePromise) {
    ensurePlaylistFilePromise = (async () => {
      try {
        await fs.access(DATA_PATH);
      } catch (error) {
        const missingFile =
          error instanceof Error && "code" in error && error.code === "ENOENT";

        if (!missingFile) {
          throw error;
        }

        const initialRaw = await fs.readFile(INITIAL_DATA_PATH, "utf-8");
        await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
        await fs.writeFile(DATA_PATH, initialRaw, "utf-8");
      }
    })();
  }

  await ensurePlaylistFilePromise;
}

async function readPlaylistData(): Promise<PlaylistData> {
  await ensurePlaylistFile();

  const stats = await fs.stat(DATA_PATH);

  if (playlistCache && playlistCache.modifiedAtMs === stats.mtimeMs) {
    return playlistCache.data;
  }

  const raw = await fs.readFile(DATA_PATH, "utf-8");
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
    videoId: string,
    categoryOverride: CategoryOverrideValue | "auto"
  ): Promise<{ categoryOverride: CategoryOverrideValue } | null> {
    const data = await readPlaylistData();
    let found = false;

    for (const season of data.seasons) {
      const video = season.videos.find((v) => v.id === videoId);
      if (video) {
        if (categoryOverride === "auto") {
          delete video.categoryOverride;
        } else {
          video.categoryOverride = categoryOverride;
        }
        found = true;
        break;
      }
    }

    if (!found) return null;

    await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");

    const stats = await fs.stat(DATA_PATH);
    playlistCache = { data, modifiedAtMs: stats.mtimeMs };

    return { categoryOverride: categoryOverride === "auto" ? null : categoryOverride };
  },

  async toggleWatched(videoId: string): Promise<{ watched: boolean } | null> {
    const data = await readPlaylistData();
    let found = false;
    let newWatched = false;

    for (const season of data.seasons) {
      const video = season.videos.find((v) => v.id === videoId);
      if (video) {
        video.watched = !video.watched;
        newWatched = video.watched;
        found = true;
        break;
      }
    }

    if (!found) return null;

    await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");

    const stats = await fs.stat(DATA_PATH);
    playlistCache = {
      data,
      modifiedAtMs: stats.mtimeMs,
    };

    return { watched: newWatched };
  },
};
