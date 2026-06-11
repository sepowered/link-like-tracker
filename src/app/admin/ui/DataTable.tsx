"use client";

/**
 * DataTable — 백오피스 공유 테이블 프리미티브 (TanStack Table v8, headless).
 *
 * 데이터-툴 컨벤션을 한 곳에 모은다:
 *   - 풀블리드 스크롤 뷰포트(DataPageShell의 바운디드 높이를 채움)
 *   - 고밀 행(~34px) + sticky 헤더, seed 디자인 토큰만 사용(third-party CSS 없음)
 *   - 헤더 클릭 정렬(끄기 가능) + 정렬 인디케이터
 *   - `columnDef.meta`로 정렬/너비/모노/말줄임/우측정렬 등 표현 제어
 *   - onRowClick이 있으면 행 전체가 클릭 가능(드릴인). 셀 내부 인터랙션은
 *     해당 셀에서 stopPropagation 처리한다.
 *
 * 렌더링은 순수 <table>; 로직만 TanStack이 담당한다. 인라인 편집은 별도
 * EditableCell이 cell 렌더러 안에서 처리하고, 이 코어는 편집 모드를 모른다.
 */

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type Row,
  type FilterFn,
} from "@tanstack/react-table";

// 셀/헤더 표현 제어용 메타. columnDef.meta에 실어 사용한다.
export interface DataTableColumnMeta {
  /** 헤더/셀 정렬. 기본 left. */
  align?: "left" | "right" | "center";
  /** 고정 너비(px). tableLayout:fixed에서 <col>로 적용. */
  width?: number;
  /** 모노 폰트(ID 등). */
  mono?: boolean;
  /** 셀 내용 한 줄 말줄임. */
  truncate?: boolean;
  /** 헤더를 uppercase 라벨로(기본 true). */
  plainHeader?: boolean;
  /** td 패딩을 0으로 — 인라인 편집 입력이 셀을 꽉 채우게(EditableCell이 자체 인셋 보유). */
  noPadding?: boolean;
}

const MONO = "'Geist Mono', 'SF Mono', ui-monospace, monospace";
const ROW_H = 34;
const HEADER_H = 36;

const th: React.CSSProperties = {
  height: HEADER_H,
  padding: "0 12px",
  textAlign: "left",
  verticalAlign: "middle",
  fontWeight: 600,
  fontSize: "11px",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--seed-color-fg-neutral-subtle)",
  backgroundColor: "var(--seed-color-bg-neutral-weak)",
  borderBottom: "1px solid var(--seed-color-stroke-neutral-subtle)",
  whiteSpace: "nowrap",
  position: "sticky",
  top: 0,
  zIndex: 1,
  userSelect: "none",
};

const td: React.CSSProperties = {
  height: ROW_H,
  padding: "0 12px",
  verticalAlign: "middle",
  fontSize: "13px",
  color: "var(--seed-color-fg-neutral)",
  borderBottom: "1px solid var(--seed-color-stroke-neutral-subtle)",
};

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  getRowId: (row: T) => string;
  /** 행 클릭(드릴인). 있으면 행에 hover/cursor가 붙는다. */
  onRowClick?: (row: T) => void;
  /** 빈 상태 문구. */
  emptyLabel?: string;
  /** 전역 검색 문자열. 부모가 입력 상태를 소유하고 값만 내려준다. */
  globalFilter?: string;
  /** 커스텀 전역 필터 함수(미지정 시 모든 셀 문자열 부분일치). */
  globalFilterFn?: FilterFn<T>;
  /** 헤더 클릭 정렬 활성화(기본 true). */
  enableSorting?: boolean;
}

function metaOf(col: { columnDef: { meta?: unknown } }): DataTableColumnMeta {
  return (col.columnDef.meta as DataTableColumnMeta) ?? {};
}

// 기본 전역 필터: 행의 모든 값(원시값)을 소문자 부분일치.
const defaultGlobalFilter: FilterFn<unknown> = (row, _id, value) => {
  const q = String(value ?? "").trim().toLowerCase();
  if (!q) return true;
  return Object.values(row.original as Record<string, unknown>).some((v) =>
    v != null && String(v).toLowerCase().includes(q),
  );
};

export function DataTable<T>({
  columns,
  data,
  getRowId,
  onRowClick,
  emptyLabel = "항목이 없습니다.",
  globalFilter,
  globalFilterFn,
  enableSorting = true,
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable<T>({
    data,
    columns,
    state: { sorting, globalFilter: globalFilter ?? "" },
    onSortingChange: setSorting,
    getRowId,
    enableSorting,
    globalFilterFn: (globalFilterFn ?? (defaultGlobalFilter as FilterFn<T>)),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div style={{ height: "100%", overflow: "auto", backgroundColor: "var(--seed-color-bg-layer-default)" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
        }}
      >
        <colgroup>
          {table.getVisibleLeafColumns().map((col) => {
            const w = metaOf(col).width;
            return <col key={col.id} style={w ? { width: w } : undefined} />;
          })}
        </colgroup>

        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const m = metaOf(header.column);
                const canSort = header.column.getCanSort();
                const dir = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    style={{
                      ...th,
                      textAlign: m.align ?? "left",
                      cursor: canSort ? "pointer" : "default",
                    }}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}
                    scope="col"
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span style={{ opacity: dir ? 1 : 0.25, fontSize: "9px" }}>
                          {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "▲"}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={table.getVisibleLeafColumns().length}
                style={{
                  ...td,
                  height: "auto",
                  padding: "56px 24px",
                  textAlign: "center",
                  color: "var(--seed-color-fg-neutral-subtle)",
                  borderBottom: "none",
                }}
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row: Row<T>) => (
              <DataTableRow key={row.id} row={row} onRowClick={onRowClick} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DataTableRow<T>({ row, onRowClick }: { row: Row<T>; onRowClick?: (row: T) => void }) {
  const [hovered, setHovered] = React.useState(false);
  const clickable = !!onRowClick;
  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={clickable ? () => onRowClick!(row.original) : undefined}
      style={{
        backgroundColor: hovered ? "var(--seed-color-bg-neutral-weak)" : "transparent",
        cursor: clickable ? "pointer" : "default",
        transition: "background-color 80ms ease",
      }}
    >
      {row.getVisibleCells().map((cell) => {
        const m = metaOf(cell.column);
        return (
          <td
            key={cell.id}
            style={{
              ...td,
              textAlign: m.align ?? "left",
              fontFamily: m.mono ? MONO : undefined,
              ...(m.truncate
                ? { maxWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
                : null),
              ...(m.noPadding ? { padding: 0 } : null),
            }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        );
      })}
    </tr>
  );
}
