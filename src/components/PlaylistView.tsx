"use client";

import { useState, useMemo } from "react";
import { PlaylistData } from "@/types";
import { VideoCategory, classifyVideoCategory } from "@/lib/video-category";
import SeasonGroup from "./SeasonGroup";
import FilterBar from "./FilterBar";
import * as Progress from "@radix-ui/react-progress";

type FilterType = "all" | "watched" | "unwatched";

function isUnavailableVideoTitle(title: string) {
  return title === "[Private video]" || title === "[Deleted video]";
}

interface Props {
  initialData: PlaylistData;
}

export default function PlaylistView({ initialData }: Props) {
  const [data, setData] = useState<PlaylistData>(initialData);
  const [filter, setFilter] = useState<FilterType>("all");
  const [category, setCategory] = useState<VideoCategory>("all");
  const [query, setQuery] = useState("");
  const [hidePrivateVideos, setHidePrivateVideos] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = data.seasons.reduce((s, season) => s + season.videos.length, 0);
    const watched = data.seasons.reduce(
      (s, season) => s + season.videos.filter((v) => v.watched).length,
      0
    );
    return { total, watched };
  }, [data]);

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
        const matchesCategory =
          category === "all" || classifyVideoCategory(v.title) === category;
        return matchesFilter && matchesQuery && matchesAvailability && matchesCategory;
      }).length;
      return total + count;
    }, 0);
  }, [data, filter, category, query, hidePrivateVideos]);

  const isFiltered = filter !== "all" || category !== "all" || query !== "" || hidePrivateVideos;

  async function handleToggle(videoId: string) {
    setErrorMessage(null);

    // Optimistic update
    setData((prev) => ({
      seasons: prev.seasons.map((season) => ({
        ...season,
        videos: season.videos.map((v) =>
          v.id === videoId ? { ...v, watched: !v.watched } : v
        ),
      })),
    }));

    try {
      const res = await fetch(`/api/playlist/${videoId}`, { method: "PATCH" });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;

        // Rollback on error
        setData((prev) => ({
          seasons: prev.seasons.map((season) => ({
            ...season,
            videos: season.videos.map((v) =>
              v.id === videoId ? { ...v, watched: !v.watched } : v
            ),
          })),
        }));

        setErrorMessage(body?.error ?? "시청 상태를 저장하지 못했습니다.");
      }
    } catch (error) {
      // Rollback on network error
      setData((prev) => ({
        seasons: prev.seasons.map((season) => ({
          ...season,
          videos: season.videos.map((v) =>
            v.id === videoId ? { ...v, watched: !v.watched } : v
          ),
        })),
      }));

      const message =
        error instanceof Error ? error.message : "시청 상태를 저장하지 못했습니다.";
      setErrorMessage(message);
    }
  }

  async function handleUpdateCategory(
    videoId: string,
    categoryOverride: "story" | "music" | "fesxlive" | "withxmeets" | null | "auto"
  ) {
    setErrorMessage(null);

    // Optimistic update
    setData((prev) => ({
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
    }));

    try {
      const res = await fetch(`/api/playlist/${videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryOverride }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        // Rollback
        setData((prev) => ({
          seasons: prev.seasons.map((season) => ({
            ...season,
            videos: season.videos.map((v) =>
              v.id === videoId ? data.seasons.flatMap((s) => s.videos).find((vi) => vi.id === videoId) ?? v : v
            ),
          })),
        }));
        setErrorMessage(body?.error ?? "태그를 저장하지 못했습니다.");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "태그를 저장하지 못했습니다.");
    }
  }

  const percent = stats.total > 0 ? Math.round((stats.watched / stats.total) * 100) : 0;

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
        category={category}
        query={query}
        hidePrivateVideos={hidePrivateVideos}
        onFilterChange={setFilter}
        onCategoryChange={setCategory}
        onQueryChange={setQuery}
        onHidePrivateVideosChange={setHidePrivateVideos}
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
          category={category}
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
