import * as React from "react";

/**
 * DataPageShell — 백오피스 공용 데이터-툴 레이아웃 (Supabase Studio / Retool 결).
 *
 * 풀-하이트 flex 컬럼. 카드/회색 여백 없이 테이블 자체가 표면이 된다.
 * 부모(<main>)가 바운디드 높이를 내려주므로 테이블 뷰포트가 내부 스크롤을
 * 맡고, sticky 헤더는 페이지가 아니라 이 뷰포트에 붙는다.
 *
 * Anatomy:
 *   Row 1 — TopBar(얇음): title/topBar(좌) + counts(인라인) + actions(우)
 *   Row 2 — toolbar 슬롯(flush, 선택): 검색/필터/추가. 카탈로그는 레벨별로 주입.
 *   Row 3 — 테이블 뷰포트: flex:1; minHeight:0; overflow:auto. 카드 래퍼 없음.
 *
 * seed 토큰만 사용. 하드코딩 색상 없음.
 */
interface DataPageShellProps {
  /** 좌측 제목 텍스트. topBar를 직접 넘기면 무시된다. */
  title?: React.ReactNode;
  /** title 대신 좌측 영역 전체를 커스텀 렌더링(브레드크럼 등). */
  topBar?: React.ReactNode;
  /** 제목 옆 인라인 카운트(작은 텍스트/필). */
  counts?: React.ReactNode;
  /** TopBar 우측 정렬 액션. */
  actions?: React.ReactNode;
  /** TopBar 아래 flush 툴바 행(검색/필터/추가). 선택 — 카탈로그는 레벨별 주입. */
  toolbar?: React.ReactNode;
  /** 테이블 영역. */
  children: React.ReactNode;
}

export function DataPageShell({
  title,
  topBar,
  counts,
  actions,
  toolbar,
  children,
}: DataPageShellProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
      }}
    >
      {/* Row 1 — TopBar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          minHeight: "48px",
          padding: "0 16px",
          flexShrink: 0,
          borderBottom: "1px solid var(--seed-color-stroke-neutral-subtle)",
          backgroundColor: "var(--seed-color-bg-layer-default)",
        }}
      >
        {topBar ?? (
          <h1
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "var(--seed-color-fg-neutral)",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </h1>
        )}
        {counts != null && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              color: "var(--seed-color-fg-neutral-subtle)",
              whiteSpace: "nowrap",
            }}
          >
            {counts}
          </div>
        )}
        {actions != null && (
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            {actions}
          </div>
        )}
      </div>

      {/* Row 2 — toolbar 슬롯 (flush) */}
      {toolbar != null && (
        <div
          style={{
            flexShrink: 0,
            borderBottom: "1px solid var(--seed-color-stroke-neutral-subtle)",
            backgroundColor: "var(--seed-color-bg-layer-default)",
          }}
        >
          {toolbar}
        </div>
      )}

      {/* Row 3 — 테이블 뷰포트 (스크롤 컨테이너) */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflow: "auto",
          backgroundColor: "var(--seed-color-bg-layer-default)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

DataPageShell.displayName = "DataPageShell";
