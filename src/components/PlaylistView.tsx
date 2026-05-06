"use client";

import { useState, useMemo, useEffect } from "react";
import { PlaylistData } from "@/types";
import { VideoCategory, classifyVideoCategory } from "@/lib/video-category";
import { useSettings } from "./SettingsProvider";
import SeasonGroup from "./SeasonGroup";
import FilterBar from "./FilterBar";
import SettingsLink from "./SettingsLink";
import * as Progress from "@radix-ui/react-progress";
import { ActionButton, Icon } from "@seed-design/react";
import {
  BottomSheetRoot,
  BottomSheetTrigger,
  BottomSheetContent,
  BottomSheetBody,
  BottomSheetFooter,
} from "@/ui/bottom-sheet";
import { RadioGroup, RadioGroupItem } from "@/ui/radio-group";
import { PageBanner, PageBannerButton } from "@/ui/page-banner";
import Link from "next/link";
import { IconChevronDownLine } from "@karrotmarket/react-monochrome-icon";

type FilterType = "all" | "watched" | "unwatched";

const STORAGE_KEY_WATCHED = "llt-watched";
const STORAGE_KEY_OVERRIDES = "llt-overrides";

function isUnavailableVideoTitle(title: string) {
  return title === "[Private video]" || title === "[Deleted video]";
}

interface Props {
  initialData: PlaylistData;
}

export default function PlaylistView({ initialData }: Props) {
  const [data, setData] = useState<PlaylistData>(initialData);
  const [filter, setFilter] = useState<FilterType>("all");
  const [categories, setCategories] = useState<VideoCategory[]>(["all"]);
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const generations = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const season of data.seasons) {
      const gen = season.id.split("-")[0];
      if (!seen.has(gen)) { seen.add(gen); result.push(gen); }
    }
    return result;
  }, [data.seasons]);

  const [generationSheetOpen, setGenerationSheetOpen] = useState(false);
  const [selectedGeneration, setSelectedGeneration] = useState<string>(
    () => {
      const seen = new Set<string>();
      for (const s of initialData.seasons) seen.add(s.id.split("-")[0]);
      const arr = [...seen];
      return arr[arr.length - 1] ?? "";
    }
  );

  const generationSeasons = useMemo(
    () => selectedGeneration === "all" ? data.seasons : data.seasons.filter((s) => s.id.startsWith(selectedGeneration + "-")),
    [data.seasons, selectedGeneration]
  );

  const [pendingGeneration, setPendingGeneration] = useState<string>(selectedGeneration);

  function handleGenerationSheetOpenChange(open: boolean) {
    if (open) setPendingGeneration(selectedGeneration);
    setGenerationSheetOpen(open);
  }

  function handleGenerationSave() {
    setSelectedGeneration(pendingGeneration);
    setGenerationSheetOpen(false);
  }
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const { progressCategories, hidePrivateVideos } = useSettings();

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const watchedIdsRaw = localStorage.getItem(STORAGE_KEY_WATCHED);
      const overridesRaw = localStorage.getItem(STORAGE_KEY_OVERRIDES);

      const watchedIds: string[] = watchedIdsRaw ? JSON.parse(watchedIdsRaw) : [];
      const overrides: Record<string, string | null> = overridesRaw ? JSON.parse(overridesRaw) : {};

      setData((prev) => ({
        seasons: prev.seasons.map((season) => ({
          ...season,
          videos: season.videos.map((v) => {
            const hasWatchedLocal = watchedIds.includes(v.id);
            const overrideLocal = overrides[v.id];
            
            return {
              ...v,
              watched: hasWatchedLocal || v.watched,
              ...(overrideLocal !== undefined ? { categoryOverride: overrideLocal as any } : {}),
            };
          }),
        })),
      }));
    } catch (e) {
      console.error("Failed to load local storage", e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Save changes to localStorage
  const saveToLocalStorage = (nextData: PlaylistData) => {
    const allVideos = nextData.seasons.flatMap((s) => s.videos);
    
    // 1. Watched IDs (only those that are different from original or all watched)
    // For simplicity, we save all currently watched IDs
    const watchedIds = allVideos.filter((v) => v.watched).map((v) => v.id);
    localStorage.setItem(STORAGE_KEY_WATCHED, JSON.stringify(watchedIds));

    // 2. Overrides
    const overrides: Record<string, any> = {};
    allVideos.forEach((v) => {
      if (v.categoryOverride !== undefined) {
        overrides[v.id] = v.categoryOverride;
      }
    });
    localStorage.setItem(STORAGE_KEY_OVERRIDES, JSON.stringify(overrides));
  };

  const stats = useMemo(() => {
    const allVideos = generationSeasons.flatMap((s) => s.videos);
    const targetVideos =
      progressCategories.length === 0
        ? allVideos
        : allVideos.filter((v) => {
            const effectiveCategory =
              v.categoryOverride !== undefined
                ? v.categoryOverride
                : classifyVideoCategory(v.title);
            return progressCategories.includes(effectiveCategory as VideoCategory);
          });
    const total = targetVideos.length;
    const watched = targetVideos.filter((v) => v.watched).length;
    return { total, watched };
  }, [generationSeasons, progressCategories]);

  // 현재 필터 조건에 맞는 영상 수 계산
  const filteredCount = useMemo(() => {
    return generationSeasons.reduce((total, season) => {
      const count = season.videos.filter((v) => {
        const matchesFilter =
          filter === "all" ||
          (filter === "watched" && v.watched) ||
          (filter === "unwatched" && !v.watched);
        const matchesQuery =
          !query || v.title.toLowerCase().includes(query.toLowerCase());
        const matchesAvailability = !hidePrivateVideos || !isUnavailableVideoTitle(v.title);
        
        const effectiveCategory = v.categoryOverride !== undefined ? v.categoryOverride : classifyVideoCategory(v.title);
        const matchesCategory =
          categories.includes("all") || categories.includes(effectiveCategory as VideoCategory);

        return matchesFilter && matchesQuery && matchesAvailability && matchesCategory;
      }).length;
      return total + count;
    }, 0);
  }, [generationSeasons, filter, categories, query, hidePrivateVideos]);

  const isFiltered = filter !== "all" || !categories.includes("all") || query !== "";

  async function handleToggle(videoId: string) {
    setData((prev) => {
      const next = {
        seasons: prev.seasons.map((season) => ({
          ...season,
          videos: season.videos.map((v) =>
            v.id === videoId ? { ...v, watched: !v.watched } : v
          ),
        })),
      };
      saveToLocalStorage(next);
      return next;
    });
  }

  async function handleUpdateCategory(
    videoId: string,
    categoryOverride: "story" | "music" | "fesxlive" | "fesxrec" | "withxmeets" | null | "auto"
  ) {
    setData((prev) => {
      const next = {
        seasons: prev.seasons.map((season) => ({
          ...season,
          videos: season.videos.map((v) => {
            if (v.id !== videoId) return v;
            if (categoryOverride === "auto") {
              const { categoryOverride: _, ...rest } = v;
              return rest;
            }
            return { ...v, categoryOverride };
          }),
        })),
      };
      saveToLocalStorage(next);
      return next;
    });
  }

  const percent = stats.total > 0 ? Math.round((stats.watched / stats.total) * 100) : 0;

  if (!isInitialized) return null; // Prevent flash of original data before local storage load

  return (
    <div>
      {/* 헤더 */}
      <div className="page-header">
        <h1 style={{ fontSize: "24px", fontWeight: "700", color: "var(--seed-color-fg-neutral)", margin: 0, letterSpacing: "-0.02em" }}>
          link-like-tracker
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {generations.length > 1 && (
            <BottomSheetRoot
              open={generationSheetOpen}
              onOpenChange={handleGenerationSheetOpenChange}
              closeOnEscape
              closeOnInteractOutside
            >
              <BottomSheetTrigger asChild>
                <ActionButton variant="ghost" size="small">
                  {selectedGeneration === "all" ? "전체" : `${selectedGeneration}기`}
                  <Icon svg={<IconChevronDownLine />} size="16px" />
                </ActionButton>
              </BottomSheetTrigger>
              <BottomSheetContent
                title="기수 선택"
                showCloseButton
                aria-describedby={undefined}
                style={{ paddingBottom: "var(--seed-safe-area-bottom)" }}
              >
                <BottomSheetBody style={{ paddingBottom: "var(--seed-dimension-x6)" }}>
                  <RadioGroup
                    aria-label="기수 선택"
                    value={pendingGeneration}
                    onValueChange={setPendingGeneration}
                  >
                    <RadioGroupItem value="all" label="전체" tone="neutral" size="large" />
                    {generations.map((gen) => (
                      <RadioGroupItem key={gen} value={gen} label={`${gen}기`} tone="neutral" size="large" />
                    ))}
                  </RadioGroup>
                </BottomSheetBody>
                <BottomSheetFooter>
                  <ActionButton
                    size="large"
                    variant="neutralSolid"
                    style={{ width: "100%" }}
                    onClick={handleGenerationSave}
                  >
                    저장
                  </ActionButton>
                </BottomSheetFooter>
              </BottomSheetContent>
            </BottomSheetRoot>
          )}
          <SettingsLink />
        </div>
      </div>

      {/* 전체 진행률 */}
      <div className="progress-section">
        <div className="progress-stats">
          <div className="progress-stat-main">
            <span className="progress-stat-watched">{stats.watched}</span>
            <span className="progress-stat-sep"> / </span>
            <span className="progress-stat-total">{stats.total}</span>
            <span className="progress-stat-unit">편 시청</span>
          </div>
          <span className="progress-stat-percent">{percent}%</span>
        </div>
        <Progress.Root className="progress-root" value={percent}>
          <Progress.Indicator
            className="progress-indicator"
            style={{ transform: `translateX(-${100 - percent}%)` }}
          />
        </Progress.Root>
      </div>

      {/* 필터 + 검색 */}
      <FilterBar
        filter={filter}
        categories={categories}
        query={query}
        sortOrder={sortOrder}
        onFilterChange={setFilter}
        onCategoriesChange={setCategories}
        onQueryChange={setQuery}
        onSortOrderChange={setSortOrder}
      />

      {/* 필터 결과 피드백 */}
      {isFiltered && (
        <div className="filter-result-bar" role="status" aria-live="polite">
          <span className="filter-result-count">{filteredCount}편</span>
          <span className="filter-result-label"> 표시 중</span>
        </div>
      )}

      {errorMessage ? (
        <p role="alert" className="error-message">
          {errorMessage}
        </p>
      ) : null}

      {/* 추가 요청 배너 */}
      <PageBanner
        tone="positive"
        description="아직 추가되지 않은 스토리 및 콘텐츠가 있나요?"
        suffix={<PageBannerButton asChild><Link href="/add-request">추가 요청하기</Link></PageBannerButton>}
      />

      {/* 시즌별 그룹 */}
      {(sortOrder === "newest" ? [...generationSeasons].reverse() : generationSeasons).map((season) => (
        <SeasonGroup
          key={season.id}
          season={season}
          filter={filter}
          categories={categories}
          query={query}
          sortOrder={sortOrder}
          hidePrivateVideos={hidePrivateVideos}
          isUnavailableVideoTitle={isUnavailableVideoTitle}
          classifyVideoCategory={classifyVideoCategory}
          onToggle={handleToggle}
          onUpdateCategory={handleUpdateCategory}
        />
      ))}
    </div>
  );
}
