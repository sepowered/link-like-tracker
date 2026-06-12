import type { PlaylistData } from "@/types";

/**
 * Canonical legacy_video_id → content.id mapping.
 * Framework-agnostic, pure/deterministic, no Supabase import.
 */
export interface LegacyMap {
  /** legacy_video_id → [content.id, ...] in document order */
  legacyToContentIds: Map<string, string[]>;
  /** all content.id values */
  contentIds: Set<string>;
}

export function buildLegacyMap(data: PlaylistData): LegacyMap {
  const legacyToContentIds = new Map<string, string[]>();
  const contentIds = new Set<string>();

  for (const season of data.seasons) {
    for (const episode of season.episodes) {
      for (const content of episode.contents) {
        contentIds.add(content.id);
        const existing = legacyToContentIds.get(content.legacy_video_id);
        if (existing) {
          existing.push(content.id);
        } else {
          legacyToContentIds.set(content.legacy_video_id, [content.id]);
        }
      }
    }
  }

  return { legacyToContentIds, contentIds };
}

export function isContentId(id: string, map: LegacyMap): boolean {
  return map.contentIds.has(id);
}

/** id is a legacy_video_id but NOT itself a content.id (the split parents) */
export function isLegacyId(id: string, map: LegacyMap): boolean {
  return map.legacyToContentIds.has(id) && !map.contentIds.has(id);
}

/**
 * Resolve ANY stored id → content.id[].
 * - content.id (265 self-mapped + all new ids) → [id], NO expansion
 * - legacy-only id (split parents) → all N content.ids
 * - unknown → [] (never throw, never drop silently)
 */
export function expandLegacyId(id: string, map: LegacyMap): string[] {
  if (map.contentIds.has(id)) return [id];
  const mapped = map.legacyToContentIds.get(id);
  if (mapped) return mapped;
  return [];
}
