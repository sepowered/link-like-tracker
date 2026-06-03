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

export function getStorageForCatalogSource(source: CatalogSource): IPlaylistStorage {
  return source === "supabase" ? supabaseStorage : jsonStorage;
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
