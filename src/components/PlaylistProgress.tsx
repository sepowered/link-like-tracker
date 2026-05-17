interface PlaylistProgressProps {
  watched: number;
  total: number;
}

export default function PlaylistProgress({ watched, total }: PlaylistProgressProps) {
  const percent = total > 0 ? Math.round((watched / total) * 100) : 0;

  return (
    <div className="progress-section">
      <div className="progress-stats">
        <span className="progress-stat-percent">{percent}%</span>
        <span className="progress-stat-fraction">({watched}/{total}편)</span>
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
