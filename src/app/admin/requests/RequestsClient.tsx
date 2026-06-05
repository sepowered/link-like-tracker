"use client";

/**
 * RequestsClient — 요청 관리 인터랙티브 UI.
 *
 * - 상태/타입 필터 (Chip)
 * - 요청 목록 (시맨틱 테이블 + seed 토큰 스타일)
 * - 행 클릭 → 상세 Bottom Sheet
 * - 상태 변경 메뉴 (MenuRoot) → updateRequestStatusAction 호출 (낙관적 업데이트)
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
        fontSize: "12px",
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
            padding: "4px 8px",
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

  return (
    <div>
      {/* 필터 영역 */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "20px",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: "13px", color: "var(--seed-color-fg-neutral-subtle)", marginRight: "4px" }}>상태</span>
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
        <span style={{ fontSize: "13px", color: "var(--seed-color-fg-neutral-subtle)", marginRight: "4px" }}>유형</span>
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

        <span
          style={{
            marginLeft: "auto",
            fontSize: "13px",
            color: "var(--seed-color-fg-neutral-subtle)",
          }}
        >
          {filtered.length}건
        </span>
      </div>

      {/* 요청 목록 */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: "48px 0",
            textAlign: "center",
            fontSize: "14px",
            color: "var(--seed-color-fg-neutral-subtle)",
          }}
        >
          요청이 없습니다.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13px",
              color: "var(--seed-color-fg-neutral)",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--seed-color-stroke-neutral-subtle)",
                  backgroundColor: "var(--seed-color-bg-layer-default)",
                }}
              >
                {["유형", "영상 제목", "링크/카테고리", "기수", "상태", "생성일", "상태 변경"].map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: "10px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      fontSize: "12px",
                      color: "var(--seed-color-fg-neutral-subtle)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: "1px solid var(--seed-color-stroke-neutral-subtle)",
                  }}
                >
                  {/* 유형 */}
                  <td style={{ padding: "12px 12px", whiteSpace: "nowrap" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "2px 6px",
                        borderRadius: "4px",
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
                  <td style={{ padding: "12px 12px", maxWidth: "200px" }}>
                    <DetailDrawer row={row} />
                  </td>

                  {/* 링크/카테고리 */}
                  <td style={{ padding: "12px 12px", maxWidth: "160px" }}>
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
                  <td style={{ padding: "12px 12px", whiteSpace: "nowrap", color: "var(--seed-color-fg-neutral-subtle)" }}>
                    {row.generation ?? "—"}
                  </td>

                  {/* 상태 */}
                  <td style={{ padding: "12px 12px", whiteSpace: "nowrap" }}>
                    <StatusBadge status={row.status} />
                  </td>

                  {/* 생성일 */}
                  <td style={{ padding: "12px 12px", whiteSpace: "nowrap", color: "var(--seed-color-fg-neutral-subtle)", fontSize: "12px" }}>
                    {row.created_at
                      ? new Date(row.created_at).toLocaleDateString("ko-KR")
                      : "—"}
                  </td>

                  {/* 상태 변경 */}
                  <td style={{ padding: "12px 12px" }}>
                    <StatusMenu row={row} onUpdate={handleStatusUpdate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
