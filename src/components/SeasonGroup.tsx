"use client";

import { useState, useMemo } from "react";
import { Season, Episode, Content } from "@/types";
import { VideoCategory } from "@/lib/video-category";
import ContentItem from "./ContentItem";
import { useSettings } from "./SettingsProvider";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/ui/accordion";

type FilterType = "all" | "watched" | "unwatched";

interface Props {
  season: Season;
  filter: FilterType;
  categories: VideoCategory[];
  query: string;
  sortOrder: "newest" | "oldest";
  hidePrivateVideos: boolean;
  onToggle: (contentId: string) => void;
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
}: {
  episode: Episode;
  filter: FilterType;
  categories: VideoCategory[];
  query: string;
  sortOrder: "newest" | "oldest";
  hidePrivateVideos: boolean;
  headingLevel?: 4 | 5;
  onToggle: (contentId: string) => void;
}) {
  const { language } = useSettings();
  // null = 사용자가 아직 직접 토글하지 않음 → 파생 기본값(시청 중 여부)을 따른다.
  // 시청 기록이 마운트 후 localStorage에서 합쳐져도 기본값이 따라 열리고,
  // 사용자가 한 번 토글하면 그 선택이 우선한다.
  const [userValues, setUserValues] = useState<string[] | null>(null);

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

  // 기본은 모두 접힘 — 시청 중(일부만 시청)인 에피소드만 열어둔다.
  const inProgress = watchedCount > 0 && watchedCount < totalCount;
  // 시청상태·카테고리 필터는 localStorage에 영구 저장되므로 강제 펼침에 쓰면
  // 접기 버튼이 영영 안 먹는다 — 기본값만 펼침으로 하고 접기는 허용한다.
  // 검색어는 일시적이니 입력 중에만 강제로 펼쳐 결과가 가려지지 않게 한다.
  const searching = query.trim().length > 0;
  const filteringActive = filter !== "all" || !categories.includes("all");
  const values = searching
    ? ["episode"]
    : userValues ?? (inProgress || filteringActive ? ["episode"] : []);

  return (
    <Accordion values={values} onValuesChange={setUserValues}>
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
        />
      ))}
    </>
  );
}
