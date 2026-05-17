"use client";

import { useState, useMemo } from "react";
import { Season, Episode, Content } from "@/types";
import { VideoCategory } from "@/lib/video-category";
import ContentItem from "./ContentItem";
import { useSettings } from "./SettingsProvider";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/ui/accordion";

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
  headingLevel?: 4 | 5;
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
  headingLevel = 4,
  onToggle,
  onUpdateCategory,
}: {
  episode: Episode;
  filter: FilterType;
  categories: VideoCategory[];
  query: string;
  sortOrder: "newest" | "oldest";
  hidePrivateVideos: boolean;
  headingLevel?: 4 | 5;
  onToggle: (contentId: string) => void;
  onUpdateCategory: (contentId: string, categoryOverride: CategoryOverrideArg) => void;
}) {
  const { language } = useSettings();
  const [values, setValues] = useState<string[]>(["episode"]);

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
    <Accordion values={values} onValuesChange={setValues}>
      <AccordionItem value="episode">
        <AccordionTrigger
          title={episodeLabel}
          description={`${watchedCount}/${totalCount}`}
          headingLevel={headingLevel}
        />
        <AccordionContent>
          {filteredContents.map((content) => (
            <ContentItem
              key={content.id}
              content={content}
              onToggle={onToggle}
              onUpdateCategory={onUpdateCategory}
            />
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
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
  headingLevel = 4,
}: Props) {
  const hasVisibleContents = useMemo(
    () =>
      season.episodes.some((ep) =>
        ep.contents.some((c) => matchesFilters(c, filter, categories, query, hidePrivateVideos))
      ),
    [season.episodes, filter, categories, query, hidePrivateVideos]
  );

  if (!hasVisibleContents) return null;

  const orderedEpisodes = sortOrder === "newest"
    ? [...season.episodes].reverse()
    : season.episodes;

  return (
    <>
      {orderedEpisodes.map((episode) => (
        <EpisodeGroup
          key={episode.id}
          episode={episode}
          filter={filter}
          categories={categories}
          query={query}
          sortOrder={sortOrder}
          hidePrivateVideos={hidePrivateVideos}
          headingLevel={headingLevel}
          onToggle={onToggle}
          onUpdateCategory={onUpdateCategory}
        />
      ))}
    </>
  );
}
