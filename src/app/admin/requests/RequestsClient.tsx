"use client";

/**
 * RequestsClient — 요청 관리 (TanStack DataTable 기반 재구축).
 *
 * 데이터-툴 방향: DataPageShell + 상태/유형 칩 필터 + 공유 DataTable(정렬·고밀·sticky).
 * 보존: 낙관적 상태 변경 + 롤백 + Snackbar, 상세 BottomSheet, safeHttpHref XSS 가드.
 * 추가: 정렬(상태/생성일/유형), D2 연결 콘텐츠(content_id) 열.
 */

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Icon } from "@seed-design/react";
import { IconChevronDownLine } from "@karrotmarket/react-monochrome-icon";
import { ButtonChip, ChipLabel } from "@/ui/chip";
import { MenuRoot, MenuTrigger, MenuContent, MenuItem } from "@/ui/menu";
import { BottomSheetRoot, BottomSheetTrigger, BottomSheetContent, BottomSheetBody } from "@/ui/bottom-sheet";
import { Snackbar, useSnackbarAdapter } from "@/ui/snackbar";
import { updateRequestStatusAction } from "@/app/admin/actions/requests";
import {
  REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  type RequestStatus,
  type RequestType,
} from "@/lib/admin/request-status";
import type { RequestRow } from "@/lib/admin/requests-types";
import { safeHttpHref } from "@/lib/safe-url";
import { DataPageShell } from "../ui/DataPageShell";
import { Toolbar } from "../ui/Toolbar";
import { DataTable, type DataTableColumnMeta } from "../ui/DataTable";

type TypeFilter = "all" | RequestType;
type StatusFilter = "all" | RequestStatus;

////////////////////////////////////////////////////////////////////////////////////
// Cell atoms

const STATUS_COLORS: Record<RequestStatus, { bg: string; fg: string }> = {
  pending: { bg: "var(--seed-color-bg-warning-weak)", fg: "var(--seed-color-fg-warning)" },
  approved: { bg: "var(--seed-color-bg-positive-weak)", fg: "var(--seed-color-fg-positive)" },
  rejected: { bg: "var(--seed-color-bg-critical-weak)", fg: "var(--seed-color-fg-critical)" },
  done: { bg: "var(--seed-color-bg-neutral-weak)", fg: "var(--seed-color-fg-neutral-subtle)" },
};

function StatusBadge({ status }: { status: string | null }) {
  const s = status as RequestStatus | null;
  const label = s && REQUEST_STATUS_LABELS[s] ? REQUEST_STATUS_LABELS[s] : (status ?? "—");
  const colors = (s && STATUS_COLORS[s]) || { bg: "var(--seed-color-bg-neutral-weak)", fg: "var(--seed-color-fg-neutral-subtle)" };
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, backgroundColor: colors.bg, color: colors.fg, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const isAdd = type === "add";
  return (
    <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 7px", borderRadius: "5px", backgroundColor: isAdd ? "var(--seed-color-bg-brand-weak)" : "var(--seed-color-bg-neutral-weak)", color: isAdd ? "var(--seed-color-fg-brand)" : "var(--seed-color-fg-neutral-subtle)" }}>
      {isAdd ? "추가" : type === "edit" ? "수정" : type}
    </span>
  );
}

function StatusMenu({ row, onUpdate }: { row: RequestRow; onUpdate: (id: string, status: RequestStatus) => void }) {
  const [pending, startTransition] = React.useTransition();
  const adapter = useSnackbarAdapter();
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <button
          disabled={pending}
          style={{ display: "flex", alignItems: "center", gap: "4px", padding: "3px 8px", border: "1px solid var(--seed-color-stroke-neutral-subtle)", borderRadius: "6px", backgroundColor: "transparent", color: "var(--seed-color-fg-neutral)", fontSize: "12px", cursor: "pointer", opacity: pending ? 0.5 : 1 }}
          aria-label="상태 변경"
        >
          변경 <Icon svg={<IconChevronDownLine />} size="12px" />
        </button>
      </MenuTrigger>
      <MenuContent>
        {REQUEST_STATUSES.map((s) => (
          <MenuItem
            key={s}
            label={REQUEST_STATUS_LABELS[s]}
            onClick={() => {
              const prev = row.status as RequestStatus | null;
              onUpdate(row.id, s);
              startTransition(async () => {
                try {
                  await updateRequestStatusAction(row.id, s);
                } catch {
                  if (prev) onUpdate(row.id, prev);
                  adapter.create({ render: () => <Snackbar variant="critical" message="상태 변경에 실패했어요. 다시 시도해 주세요." /> });
                }
              });
            }}
          />
        ))}
      </MenuContent>
    </MenuRoot>
  );
}

function DetailDrawer({ row }: { row: RequestRow }) {
  const fields: Array<{ label: string; value: string | null | undefined }> = [
    { label: "ID", value: row.id },
    { label: "유형", value: row.type },
    { label: "상태", value: row.status },
    { label: "연결 콘텐츠", value: row.content_id },
    { label: "영상 제목", value: row.video_title },
    { label: "링크", value: row.link },
    { label: "요청 타입", value: row.request_type },
    { label: "카테고리", value: row.category },
    { label: "기수", value: row.generation },
    { label: "설명", value: row.description },
    { label: "생성일", value: row.created_at ? new Date(row.created_at).toLocaleString("ko-KR") : null },
  ];
  return (
    <BottomSheetRoot>
      <BottomSheetTrigger asChild>
        <button style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--seed-color-fg-brand)", fontSize: "13px", textDecoration: "underline", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
          {row.video_title ?? row.link ?? row.id.slice(0, 8) + "…"}
        </button>
      </BottomSheetTrigger>
      <BottomSheetContent title="요청 상세" showHandle>
        <BottomSheetBody>
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px", padding: "8px 0" }}>
            {fields.map(({ label, value }) =>
              value != null ? (
                <React.Fragment key={label}>
                  <dt style={{ fontSize: "12px", color: "var(--seed-color-fg-neutral-subtle)", fontWeight: 600, paddingTop: "2px", whiteSpace: "nowrap" }}>{label}</dt>
                  <dd style={{ fontSize: "14px", color: "var(--seed-color-fg-neutral)", margin: 0, wordBreak: "break-all" }}>
                    {label === "링크"
                      ? (() => {
                          const href = safeHttpHref(value);
                          return href ? (
                            <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--seed-color-fg-brand)" }}>{value}</a>
                          ) : (
                            <span style={{ color: "var(--seed-color-fg-neutral-subtle)" }}>{value}</span>
                          );
                        })()
                      : value}
                  </dd>
                </React.Fragment>
              ) : null,
            )}
          </dl>
        </BottomSheetBody>
      </BottomSheetContent>
    </BottomSheetRoot>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Main

interface RequestsClientProps {
  initialRows: RequestRow[];
}

export default function RequestsClient({ initialRows }: RequestsClientProps) {
  const [rows, setRows] = React.useState<RequestRow[]>(initialRows);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");

  const handleStatusUpdate = React.useCallback((id: string, status: RequestStatus) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }, []);

  const filtered = React.useMemo(
    () =>
      rows.filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (typeFilter !== "all" && r.type !== typeFilter) return false;
        return true;
      }),
    [rows, statusFilter, typeFilter],
  );

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  const columns = React.useMemo<ColumnDef<RequestRow, unknown>[]>(
    () => [
      {
        accessorKey: "type",
        header: "유형",
        meta: { width: 72 } satisfies DataTableColumnMeta,
        cell: ({ getValue }) => <TypeBadge type={String(getValue() ?? "")} />,
      },
      {
        accessorKey: "video_title",
        header: "영상 제목 / 상세",
        enableSorting: false,
        meta: { truncate: true } satisfies DataTableColumnMeta,
        cell: ({ row }) => <DetailDrawer row={row.original} />,
      },
      {
        accessorKey: "category",
        header: "카테고리/링크",
        meta: { width: 140, truncate: true } satisfies DataTableColumnMeta,
        cell: ({ row }) => (
          <span title={row.original.link ?? row.original.category ?? "—"} style={{ color: "var(--seed-color-fg-neutral-subtle)", fontSize: "12px" }}>
            {row.original.category ?? (row.original.link ? "링크 있음" : "—")}
          </span>
        ),
      },
      {
        accessorKey: "generation",
        header: "기수",
        meta: { width: 70, align: "left" } satisfies DataTableColumnMeta,
        cell: ({ getValue }) => <span style={{ color: "var(--seed-color-fg-neutral-subtle)", fontSize: "12px" }}>{String(getValue() ?? "—") || "—"}</span>,
      },
      {
        accessorKey: "content_id",
        header: "연결 콘텐츠",
        meta: { width: 130, mono: true, truncate: true } satisfies DataTableColumnMeta,
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? (
            <span style={{ fontSize: "11px", color: "var(--seed-color-fg-neutral-subtle)" }} title={v}>{v}</span>
          ) : (
            <span style={{ color: "var(--seed-color-fg-neutral-subtle)" }}>—</span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "상태",
        meta: { width: 90 } satisfies DataTableColumnMeta,
        cell: ({ getValue }) => <StatusBadge status={(getValue() as string | null) ?? null} />,
      },
      {
        accessorKey: "created_at",
        header: "생성일",
        meta: { width: 110 } satisfies DataTableColumnMeta,
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return <span style={{ color: "var(--seed-color-fg-neutral-subtle)", fontSize: "12px" }}>{v ? new Date(v).toLocaleDateString("ko-KR") : "—"}</span>;
        },
      },
      {
        id: "actions",
        header: "상태 변경",
        enableSorting: false,
        meta: { width: 84 } satisfies DataTableColumnMeta,
        cell: ({ row }) => <StatusMenu row={row.original} onUpdate={handleStatusUpdate} />,
      },
    ],
    [handleStatusUpdate],
  );

  const counts = (
    <>
      <span>총 {rows.length}건</span>
      {pendingCount > 0 && (
        <span style={{ color: "var(--seed-color-fg-warning)", fontWeight: 600 }}>대기 {pendingCount}건</span>
      )}
    </>
  );

  const filterLabel: React.CSSProperties = { fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--seed-color-fg-neutral-subtle)", marginRight: "2px" };

  const toolbar = (
    <Toolbar
      divider={false}
      filters={
        <>
          <span style={filterLabel}>상태</span>
          {(["all", ...REQUEST_STATUSES] as const).map((s) => (
            <ButtonChip key={s} size="small" variant={statusFilter === s ? "solid" : "outlineWeak"} onClick={() => setStatusFilter(s)} aria-pressed={statusFilter === s}>
              <ChipLabel>{s === "all" ? "전체" : REQUEST_STATUS_LABELS[s]}</ChipLabel>
            </ButtonChip>
          ))}
          <span style={{ width: "1px", height: "16px", backgroundColor: "var(--seed-color-stroke-neutral-subtle)", margin: "0 4px" }} />
          <span style={filterLabel}>유형</span>
          {(["all", "add", "edit"] as const).map((t) => (
            <ButtonChip key={t} size="small" variant={typeFilter === t ? "solid" : "outlineWeak"} onClick={() => setTypeFilter(t)} aria-pressed={typeFilter === t}>
              <ChipLabel>{t === "all" ? "전체" : t === "add" ? "추가" : "수정"}</ChipLabel>
            </ButtonChip>
          ))}
        </>
      }
      actions={<span style={{ fontSize: "12px", color: "var(--seed-color-fg-neutral-subtle)", whiteSpace: "nowrap" }}>{filtered.length}건</span>}
    />
  );

  return (
    <DataPageShell title="요청 관리" counts={counts} toolbar={toolbar}>
      <DataTable<RequestRow>
        columns={columns}
        data={filtered}
        getRowId={(r) => r.id}
        emptyLabel="요청이 없습니다."
      />
    </DataPageShell>
  );
}
