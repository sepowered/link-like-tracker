import * as Progress from "@radix-ui/react-progress";

interface PlaylistProgressProps {
  watched: number;
  total: number;
}

export default function PlaylistProgress({ watched, total }: PlaylistProgressProps) {
  const percent = total > 0 ? Math.round((watched / total) * 100) : 0;

  return (
    <div className="progress-section">
      <div className="progress-stats">
        <div className="progress-stat-main">
          <span className="progress-stat-watched">{watched}</span>
          <span className="progress-stat-sep"> / </span>
          <span className="progress-stat-total">{total}</span>
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
  );
}
