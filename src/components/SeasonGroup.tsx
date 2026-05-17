"use client";

import { useState, useMemo } from "react";
import { Season, Episode, Content } from "@/types";
import { VideoCategory } from "@/lib/video-category";
import ContentItem from "./ContentItem";
import { useSettings } from "./SettingsProvider";
import * as Progress from "@radix-ui/react-progress";

type FilterType = "all" | "watched" | "unwatched";
type CategoryOverrideArg = "story" | "music" | "fesxlive" | "fesxrec" | "withxmeets" | null | "auto";

interface Props {
  season: Season;
  filter: FilterType;
  categories: VideoCategory[];
  query: string;
  sortOrder: "newest" | "oldest";
  hidePrivateVideos: boolean;
  onToggle: (contentId: string) => void;
  onUpdateCategory: (contentId: string, categoryOverride: CategoryOverrideArg) => void;
}

function matchesFilters(
  content: Content,
  filter: FilterType,
  categories: VideoCategory[],
  query: string,
  hidePrivateVideos: boolean
): boolean {
  if (filter === "watched" && !content.watched) return false;
  if (filter === "unwatched" && content.watched) return false;
  if (hidePrivateVideos && content.type === "unavailable") return false;

  if (query) {
    const q = query.toLowerCase();
    const inTitle = (content.title_ko ?? "").toLowerCase().includes(q)
      || (content.title_jp ?? "").toLowerCase().includes(q)
      || (content.part_label ?? "").toLowerCase().includes(q);
    if (!inTitle) return false;
  }

  if (!categories.includes("all")) {
    const effectiveCategory = content.categoryOverride !== undefined ? content.categoryOverride : content.type;
    if (!categories.includes(effectiveCategory as VideoCategory)) return false;
  }

  return true;
}

function EpisodeGroup({
  episode,
  filter,
  categories,
  query,
  sortOrder,
  hidePrivateVideos,
  onToggle,
  onUpdateCategory,
}: {
  episode: Episode;
  filter: FilterType;
  categories: VideoCategory[];
  query: string;
  sortOrder: "newest" | "oldest";
  hidePrivateVideos: boolean;
  onToggle: (contentId: string) => void;
  onUpdateCategory: (contentId: string, categoryOverride: CategoryOverrideArg) => void;
}) {
  const { language } = useSettings();
  const [open, setOpen] = useState(true);

  const filteredContents = useMemo(() => {
    const matched = episode.contents.filter((c) =>
      matchesFilters(c, filter, categories, query, hidePrivateVideos)
    );
    return sortOrder === "newest" ? [...matched].reverse() : matched;
  }, [episode.contents, filter, categories, query, sortOrder, hidePrivateVideos]);

  if (filteredContents.length === 0) return null;

  const watchedCount = episode.contents.filter((c) => c.watched).length;
  const totalCount = episode.contents.length;
  const episodeTitle = language === "jp" ? episode.title_jp : episode.title_ko;
  const episodeLabel = episode.episode_number > 0
    ? `${episode.episode_number}장 — ${episodeTitle}`
    : episodeTitle;

  return (
    <div className="episode-group">
      <button className="episode-header" onClick={() => setOpen((o) => !o)}>
        <div className="episode-header-left">
          <span className={`chevron chevron--small ${open ? "open" : ""}`}>▼</span>
          <span className="episode-title">{episodeLabel}</span>
        </div>
        <span className="episode-progress-text">
          {watchedCount}/{totalCount}
        </span>
      </button>
      {open && (
        <div className="season-videos">
          {filteredContents.map((content) => (
            <ContentItem
              key={content.id}
              content={content}
              onToggle={onToggle}
              onUpdateCategory={onUpdateCategory}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SeasonGroup({
  season,
  filter,
  categories,
  query,
  sortOrder,
  hidePrivateVideos,
  onToggle,
  onUpdateCategory,
}: Props) {
  const [open, setOpen] = useState(true);

  const allContents = useMemo(
    () => season.episodes.flatMap((ep) => ep.contents),
    [season.episodes]
  );

  const hasVisibleContents = useMemo(
    () =>
      season.episodes.some((ep) =>
        ep.contents.some((c) => matchesFilters(c, filter, categories, query, hidePrivateVideos))
      ),
    [season.episodes, filter, categories, query, hidePrivateVideos]
  );

  if (!hasVisibleContents) return null;

  const watchedCount = allContents.filter((c) => c.watched).length;
  const totalCount = allContents.length;
  const seasonPercent = totalCount > 0 ? Math.round((watchedCount / totalCount) * 100) : 0;

  const orderedEpisodes = sortOrder === "newest"
    ? [...season.episodes].reverse()
    : season.episodes;

  return (
    <div className="season-group">
      <button className="season-header" onClick={() => setOpen((o) => !o)}>
        <div className="season-header-left">
          <span className={`chevron ${open ? "open" : ""}`}>▼</span>
          <span className="season-name">{season.name}</span>
        </div>
        <div className="season-header-right">
          <Progress.Root className="season-mini-progress" value={seasonPercent}>
            <Progress.Indicator
              className="season-mini-progress-fill"
              style={{ transform: `translateX(-${100 - seasonPercent}%)` }}
            />
          </Progress.Root>
          <span className="season-progress-text">
            {watchedCount}/{totalCount}
          </span>
        </div>
      </button>
      {open && (
        <div className="season-videos">
          {orderedEpisodes.map((episode) => (
            <EpisodeGroup
              key={episode.id}
              episode={episode}
              filter={filter}
              categories={categories}
              query={query}
              sortOrder={sortOrder}
              hidePrivateVideos={hidePrivateVideos}
              onToggle={onToggle}
              onUpdateCategory={onUpdateCategory}
            />
          ))}
        </div>
      )}
    </div>
  );
}
