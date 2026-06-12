export type CatalogSource = "json" | "supabase";

export const CATALOG_SOURCE_COOKIE = "llt-catalog-source";

export function isCatalogSource(value: unknown): value is CatalogSource {
  return value === "json" || value === "supabase";
}

export function isCatalogSourceLabEnabled(): boolean {
  return (
    process.env.CATALOG_SOURCE_LAB === "enabled" ||
    process.env.NODE_ENV !== "production" ||
    process.env.VERCEL_ENV === "preview"
  );
}

export function getDefaultCatalogSource(): CatalogSource {
  return process.env.CATALOG_SOURCE === "supabase" ? "supabase" : "json";
}
