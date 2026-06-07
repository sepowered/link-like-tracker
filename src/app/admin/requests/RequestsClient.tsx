"use client";

/**
 * RequestsClient — 요청 관리 인터랙티브 UI.
 *
 * DataPageShell을 직접 렌더한다:
 *   - TopBar: "요청 관리" 타이틀 + 인라인 카운트(총/대기)
 *   - toolbar 슬롯: 상태 필터 + 유형 필터 (Chip)
 *   - 테이블 영역: 풀블리드 시맨틱 테이블 (~34px 밀도, sticky 헤더, hover, 상태 배지)
 *
 * 보존:
 *   - 상태/유형 필터, updateRequestStatusAction 전환
 *   - 낙관적 업데이트 + 롤백 + Snackbar
 *   - safeHttpHref XSS 가드
 *   - 상세 Bottom Sheet
 */

import * as React from "react";
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

////////////////////////////////////////////////////////////////////////////////////
// Types

type TypeFilter = "all" | RequestType;
type StatusFilter = "all" | RequestStatus;

////////////////////////////////////////////////////////////////////////////////////
// Status badge

const STATUS_COLORS: Record<RequestStatus, { bg: string; fg: string }> = {
  pending: { bg: "var(--seed-color-bg-warning-weak)", fg: "var(--seed-color-fg-warning)" },
  approved: { bg: "var(--seed-color-bg-positive-weak)", fg: "var(--seed-color-fg-positive)" },
  rejected: { bg: "var(--seed-color-bg-critical-weak)", fg: "var(--seed-color-fg-critical)" },
  done: { bg: "var(--seed-color-bg-neutral-weak)", fg: "var(--seed-color-fg-neutral-subtle)" },
};

function StatusBadge({ status }: { status: string | null }) {
  const s = status as RequestStatus | null;
  const label = s && REQUEST_STATUS_LABELS[s] ? REQUEST_STATUS_LABELS[s] : (status ?? "—");
  const colors = s && STATUS_COLORS[s] ? STATUS_COLORS[s] : { bg: "var(--seed-color-bg-neutral-weak)", fg: "var(--seed-color-fg-neutral-subtle)" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 600,
        backgroundColor: colors.bg,
        color: colors.fg,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Status change menu

function StatusMenu({ row, onUpdate }: { row: RequestRow; onUpdate: (id: string, status: RequestStatus) => void }) {
  const [pending, startTransition] = React.useTransition();
  const adapter = useSnackbarAdapter();

  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <button
          disabled={pending}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "3px 8px",
            border: "1px solid var(--seed-color-stroke-neutral-subtle)",
            borderRadius: "6px",
            backgroundColor: "transparent",
            color: "var(--seed-color-fg-neutral)",
            fontSize: "12px",
            cursor: "pointer",
            opacity: pending ? 0.5 : 1,
          }}
          aria-label="상태 변경"
        >
          변경
          <Icon svg={<IconChevronDownLine />} size="12px" />
        </button>
      </MenuTrigger>
      <MenuContent>
        {REQUEST_STATUSES.map((s) => (
          <MenuItem
            key={s}
            label={REQUEST_STATUS_LABELS[s]}
            onClick={() => {
              const prevStatus = row.status as RequestStatus | null;
              // 낙관적 업데이트 먼저 적용
              onUpdate(row.id, s);
              startTransition(async () => {
                try {
                  await updateRequestStatusAction(row.id, s);
                } catch {
                  // 실패 시 이전 상태로 복원
                  if (prevStatus) onUpdate(row.id, prevStatus);
                  adapter.create({
                    render: () => (
                      <Snackbar
                        variant="critical"
                        message="상태 변경에 실패했어요. 다시 시도해 주세요."
                      />
                    ),
                  });
                }
              });
            }}
          />
        ))}
      </MenuContent>
    </MenuRoot>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Detail drawer

function DetailDrawer({ row }: { row: RequestRow }) {
  const fields: Array<{ label: string; value: string | null | undefined }> = [
    { label: "ID", value: row.id },
    { label: "유형", value: row.type },
    { label: "상태", value: row.status },
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
        <button
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: "var(--seed-color-fg-brand)",
            fontSize: "13px",
            textDecoration: "underline",
            textAlign: "left",
          }}
        >
          {row.video_title ?? row.link ?? row.id.slice(0, 8) + "…"}
        </button>
      </BottomSheetTrigger>
      <BottomSheetContent title="요청 상세" showHandle>
        <BottomSheetBody>
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px", padding: "8px 0" }}>
            {fields.map(({ label, value }) =>
              value != null ? (
                <React.Fragment key={label}>
                  <dt
                    style={{
                      fontSize: "12px",
                      color: "var(--seed-color-fg-neutral-subtle)",
                      fontWeight: 600,
                      paddingTop: "2px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </dt>
                  <dd
                    style={{
                      fontSize: "14px",
                      color: "var(--seed-color-fg-neutral)",
                      margin: 0,
                      wordBreak: "break-all",
                    }}
                  >
                    {label === "링크" ? (() => {
                      const safeHref = safeHttpHref(value);
                      return safeHref ? (
                        <a
                          href={safeHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "var(--seed-color-fg-brand)" }}
                        >
                          {value}
                        </a>
                      ) : (
                        // javascript: / data: 등 위험 스킴 — 비활성 텍스트로 렌더
                        <span style={{ color: "var(--seed-color-fg-neutral-subtle)" }}>{value}</span>
                      );
                    })() : (
                      value
                    )}
                  </dd>
                </React.Fragment>
              ) : null
            )}
          </dl>
        </BottomSheetBody>
      </BottomSheetContent>
    </BottomSheetRoot>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Main client component

interface RequestsClientProps {
  initialRows: RequestRow[];
}

export default function RequestsClient({ initialRows }: RequestsClientProps) {
  const [rows, setRows] = React.useState<RequestRow[]>(initialRows);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");

  // Update a single row's status optimistically
  function handleStatusUpdate(id: string, status: RequestStatus) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
  }

  const filtered = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    return true;
  });

  // 카운트 — 총건수 + 대기건수 인라인 (TopBar counts 슬롯)
  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const counts = (
    <>
      <span>총 {rows.length}건</span>
      {pendingCount > 0 && (
        <span style={{ color: "var(--seed-color-fg-warning)", fontWeight: 600 }}>
          대기 {pendingCount}건
        </span>
      )}
    </>
  );

  // 필터 툴바 — DataPageShell toolbar 슬롯에 주입 (셸이 하단 보더+bg 처리)
  const toolbar = (
    <Toolbar
      divider={false}
      filters={
        <>
          <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--seed-color-fg-neutral-subtle)", marginRight: "2px" }}>
            상태
          </span>
          {(["all", ...REQUEST_STATUSES] as const).map((s) => (
            <ButtonChip
              key={s}
              size="small"
              variant={statusFilter === s ? "solid" : "outlineWeak"}
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
            >
              <ChipLabel>{s === "all" ? "전체" : REQUEST_STATUS_LABELS[s]}</ChipLabel>
            </ButtonChip>
          ))}
          <span
            style={{
              width: "1px",
              height: "16px",
              backgroundColor: "var(--seed-color-stroke-neutral-subtle)",
              margin: "0 4px",
            }}
          />
          <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--seed-color-fg-neutral-subtle)", marginRight: "2px" }}>
            유형
          </span>
          {(["all", "add", "edit"] as const).map((t) => (
            <ButtonChip
              key={t}
              size="small"
              variant={typeFilter === t ? "solid" : "outlineWeak"}
              onClick={() => setTypeFilter(t)}
              aria-pressed={typeFilter === t}
            >
              <ChipLabel>{t === "all" ? "전체" : t === "add" ? "추가" : "수정"}</ChipLabel>
            </ButtonChip>
          ))}
        </>
      }
      actions={
        <span style={{ fontSize: "12px", color: "var(--seed-color-fg-neutral-subtle)", whiteSpace: "nowrap" }}>
          {filtered.length}건
        </span>
      }
    />
  );

  const COLUMNS = ["유형", "영상 제목", "링크/카테고리", "기수", "상태", "생성일", "상태 변경"];

  return (
    <DataPageShell title="요청 관리" counts={counts} toolbar={toolbar}>
      {/* 요청 목록 — 풀블리드, Panel/카드 없음 */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: "56px 24px",
            textAlign: "center",
            fontSize: "13px",
            color: "var(--seed-color-fg-neutral-subtle)",
          }}
        >
          요청이 없습니다.
        </div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "13px",
            color: "var(--seed-color-fg-neutral)",
          }}
        >
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col}
                  style={{
                    padding: "0 12px",
                    height: "34px",
                    textAlign: "left",
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
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <RequestTableRow
                key={row.id}
                row={row}
                onUpdate={handleStatusUpdate}
              />
            ))}
          </tbody>
        </table>
      )}
    </DataPageShell>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Table row — hover state + dense ~34px rows

function RequestTableRow({
  row,
  onUpdate,
}: {
  row: RequestRow;
  onUpdate: (id: string, status: RequestStatus) => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const cellStyle: React.CSSProperties = {
    padding: "0 12px",
    height: "34px",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
    borderBottom: "1px solid var(--seed-color-stroke-neutral-subtle)",
  };

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: hovered ? "var(--seed-color-bg-neutral-weak)" : "transparent",
        transition: "background-color 80ms ease",
      }}
    >
      {/* 유형 */}
      <td style={cellStyle}>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            padding: "2px 7px",
            borderRadius: "5px",
            backgroundColor: row.type === "add"
              ? "var(--seed-color-bg-brand-weak)"
              : "var(--seed-color-bg-neutral-weak)",
            color: row.type === "add"
              ? "var(--seed-color-fg-brand)"
              : "var(--seed-color-fg-neutral-subtle)",
          }}
        >
          {row.type === "add" ? "추가" : row.type === "edit" ? "수정" : row.type}
        </span>
      </td>

      {/* 영상 제목 (클릭 → 상세) */}
      <td style={{ ...cellStyle, maxWidth: "240px", whiteSpace: "normal" }}>
        <DetailDrawer row={row} />
      </td>

      {/* 링크/카테고리 */}
      <td style={{ ...cellStyle, maxWidth: "160px" }}>
        <span
          style={{
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "var(--seed-color-fg-neutral-subtle)",
            fontSize: "12px",
          }}
          title={row.link ?? row.category ?? "—"}
        >
          {row.category ?? (row.link ? "링크 있음" : "—")}
        </span>
      </td>

      {/* 기수 */}
      <td style={{ ...cellStyle, color: "var(--seed-color-fg-neutral-subtle)", fontSize: "12px" }}>
        {row.generation ?? "—"}
      </td>

      {/* 상태 */}
      <td style={cellStyle}>
        <StatusBadge status={row.status} />
      </td>

      {/* 생성일 */}
      <td style={{ ...cellStyle, color: "var(--seed-color-fg-neutral-subtle)", fontSize: "12px" }}>
        {row.created_at
          ? new Date(row.created_at).toLocaleDateString("ko-KR")
          : "—"}
      </td>

      {/* 상태 변경 */}
      <td style={cellStyle}>
        <StatusMenu row={row} onUpdate={onUpdate} />
      </td>
    </tr>
  );
}
