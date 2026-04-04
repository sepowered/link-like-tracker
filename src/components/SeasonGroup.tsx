"use client";

import { useState, useMemo } from "react";
import { Season, Video } from "@/types";
import { VideoCategory } from "@/lib/video-category";
import VideoItem from "./VideoItem";
import * as Progress from "@radix-ui/react-progress";

type FilterType = "all" | "watched" | "unwatched";
type CategoryOverrideArg = "story" | "music" | "fesxlive" | "withxmeets" | null | "auto";

interface Props {
  season: Season;
  filter: FilterType;
  category: VideoCategory;
  query: string;
  hidePrivateVideos: boolean;
  isUnavailableVideoTitle: (title: string) => boolean;
  classifyVideoCategory: (title: string) => Exclude<VideoCategory, "all"> | null;
  onToggle: (videoId: string) => void;
  onUpdateCategory: (videoId: string, categoryOverride: CategoryOverrideArg) => void;
}

function getEffectiveCategory(
  video: Video,
  classifyVideoCategory: (title: string) => Exclude<VideoCategory, "all"> | null
) {
  return video.categoryOverride !== undefined
    ? video.categoryOverride
    : classifyVideoCategory(video.title);
}

export default function SeasonGroup({
  season,
  filter,
  category,
  query,
  hidePrivateVideos,
  isUnavailableVideoTitle,
  classifyVideoCategory,
  onToggle,
  onUpdateCategory,
}: Props) {
  const [open, setOpen] = useState(true);

  const filteredVideos = useMemo(() => {
    return season.videos.filter((v) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "watched" && v.watched) ||
        (filter === "unwatched" && !v.watched);
      const matchesQuery =
        !query || v.title.toLowerCase().includes(query.toLowerCase());
      const matchesAvailability = !hidePrivateVideos || !isUnavailableVideoTitle(v.title);
      const matchesCategory =
        category === "all" || getEffectiveCategory(v, classifyVideoCategory) === category;
      return matchesFilter && matchesQuery && matchesAvailability && matchesCategory;
    });
  }, [season.videos, filter, category, query, hidePrivateVideos, isUnavailableVideoTitle, classifyVideoCategory]);

  if (filteredVideos.length === 0) return null;

  const watchedCount = season.videos.filter((v) => v.watched).length;
  const totalCount = season.videos.length;
  const seasonPercent = totalCount > 0 ? Math.round((watchedCount / totalCount) * 100) : 0;

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
          {filteredVideos.map((video) => (
            <VideoItem
              key={video.id}
              video={video}
              category={classifyVideoCategory(video.title)}
              onToggle={onToggle}
              onUpdateCategory={onUpdateCategory}
            />
          ))}
        </div>
      )}
    </div>
  );
}
