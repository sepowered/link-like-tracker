import { jsonStorage } from "./playlist.json";
import { supabaseStorage } from "./playlist.supabase";
import type { IPlaylistStorage } from "./storage";
import { cookies } from "next/headers";
import {
  CATALOG_SOURCE_COOKIE,
  getDefaultCatalogSource,
  isCatalogSource,
  isCatalogSourceLabEnabled,
  type CatalogSource,
} from "./catalog-source";

// Supabase 카탈로그가 죽거나(네트워크/키 문제) 비어 있으면(시드 안 됨) 번들 JSON으로
// 폴백한다 — 카탈로그 읽기는 앱의 생명선이라 단일 장애점이 되면 안 된다.
function withJsonFallback(primary: IPlaylistStorage): IPlaylistStorage {
  return {
    async getPlaylist() {
      try {
        const data = await primary.getPlaylist();
        if (data.seasons.length === 0) {
          console.warn("[catalog] supabase 카탈로그가 비어 있음(시드 안 됨?) — 번들 JSON으로 폴백");
          return jsonStorage.getPlaylist();
        }
        return data;
      } catch (error) {
        console.error("[catalog] supabase 카탈로그 읽기 실패 — 번들 JSON으로 폴백", error);
        return jsonStorage.getPlaylist();
      }
    },
    setCategoryOverride: (contentId, categoryOverride) =>
      primary.setCategoryOverride(contentId, categoryOverride),
    toggleWatched: (contentId) => primary.toggleWatched(contentId),
  };
}

export function getStorageForCatalogSource(source: CatalogSource): IPlaylistStorage {
  return source === "supabase" ? withJsonFallback(supabaseStorage) : jsonStorage;
}

export async function getRequestCatalogSource(): Promise<CatalogSource> {
  const defaultSource = getDefaultCatalogSource();
  if (!isCatalogSourceLabEnabled()) return defaultSource;

  const cookieStore = await cookies();
  const override = cookieStore.get(CATALOG_SOURCE_COOKIE)?.value;

  return isCatalogSource(override) ? override : defaultSource;
}

export async function getRequestPlaylistStorage(): Promise<IPlaylistStorage> {
  return getStorageForCatalogSource(await getRequestCatalogSource());
}

export const storage: IPlaylistStorage = getStorageForCatalogSource(getDefaultCatalogSource());

export type { IPlaylistStorage };
export {
  CATALOG_SOURCE_COOKIE,
  getDefaultCatalogSource,
  isCatalogSource,
  isCatalogSourceLabEnabled,
};
export type { CatalogSource };
