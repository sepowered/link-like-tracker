"use client";

import { useState, useMemo, useEffect } from "react";
import { PlaylistData } from "@/types";
import { VideoCategory, classifyVideoCategory } from "@/lib/video-category";
import { useSettings } from "./SettingsProvider";
import SeasonGroup from "./SeasonGroup";
import FilterBar from "./FilterBar";
import * as Progress from "@radix-ui/react-progress";

type FilterType = "all" | "watched" | "unwatched";

const STORAGE_KEY_WATCHED = "oh-my-hasu-watched";
const STORAGE_KEY_OVERRIDES = "oh-my-hasu-overrides";

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
    const allVideos = data.seasons.flatMap((s) => s.videos);
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
  }, [data, progressCategories]);

  // 현재 필터 조건에 맞는 영상 수 계산
  const filteredCount = useMemo(() => {
    return data.seasons.reduce((total, season) => {
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
  }, [data, filter, categories, query, hidePrivateVideos]);

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
        onFilterChange={setFilter}
        onCategoriesChange={setCategories}
        onQueryChange={setQuery}
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

      {/* 시즌별 그룹 */}
      {data.seasons.map((season) => (
        <SeasonGroup
          key={season.id}
          season={season}
          filter={filter}
          categories={categories}
          query={query}
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
