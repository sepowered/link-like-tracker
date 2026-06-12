import { Badge } from "@seed-design/react";
import { VideoCategory, getVideoCategoryLabel } from "@/lib/video-category";

interface PlaylistProgressProps {
  watched: number;
  total: number;
  progressCategories: VideoCategory[];
}

export default function PlaylistProgress({ watched, total, progressCategories }: PlaylistProgressProps) {
  const percent = total > 0 ? Math.round((watched / total) * 100) : 0;
  const selected = progressCategories.filter((c): c is Exclude<VideoCategory, "all"> => c !== "all");

  return (
    <div className="progress-section">
      <div className="progress-stats">
        <div className="progress-stat-left">
          <span className="progress-stat-percent">{percent}%</span>
          <span className="progress-stat-fraction">({watched}/{total}편)</span>
        </div>
        {selected.length > 0 && (
          <div className="progress-stat-badges">
            {selected.map((c) => (
              <Badge key={c} variant="weak" tone="neutral" size="medium">
                {getVideoCategoryLabel(c)}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
