import * as React from "react";

/**
 * Toolbar — Panel 안에서 표 위에 놓는 컨트롤 행.
 *
 * 좌측에 검색 슬롯, 그 옆에 필터 슬롯, 우측 끝에 액션 슬롯(추가 버튼 등)을 둔다.
 * 모든 슬롯은 선택적. noPadding Panel 안에서 쓸 때를 위해 자체 패딩과 하단
 * 구분선을 갖는다. seed 토큰만 사용.
 */
interface ToolbarProps {
  /** 검색 입력 슬롯 (좌측). */
  search?: React.ReactNode;
  /** 필터/칩 슬롯 (검색 우측). */
  filters?: React.ReactNode;
  /** 액션 슬롯 (우측 정렬). */
  actions?: React.ReactNode;
  /** 표/그리드와 붙는 하단 구분선 표시 여부. */
  divider?: boolean;
}

export function Toolbar({ search, filters, actions, divider = true }: ToolbarProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap",
        padding: "12px 16px",
        borderBottom: divider
          ? "1px solid var(--seed-color-stroke-neutral-subtle)"
          : "none",
      }}
    >
      {search != null && (
        <div style={{ flex: "1 1 220px", minWidth: "160px", maxWidth: "340px" }}>
          {search}
        </div>
      )}
      {filters != null && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {filters}
        </div>
      )}
      <div style={{ flex: 1 }} />
      {actions != null && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
}
