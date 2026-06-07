"use client";

/**
 * CatalogClient — 드릴다운 테이블 브라우저 (Stripe/Vercel 스타일)
 *
 * 4단계 드릴다운: 시즌 → 에피소드 → 콘텐츠 → 소스
 * - 행 클릭으로 하위 레벨 진입, 브레드크럼으로 상위 복귀
 * - 현재 레벨 클라이언트 검색 (제목/ID)
 * - 낙관적 업데이트 + 실패 시 스냅샷 롤백 + Snackbar 오류 표시
 * - seed-design + src/ui 전용 (외부 라이브러리 없음)
 */

import * as React from "react";
import { ContentsGrid } from "./ContentsGrid";
import {
  BottomSheetRoot,
  BottomSheetTrigger,
  BottomSheetContent,
  BottomSheetBody,
  BottomSheetFooter,
} from "@/ui/bottom-sheet";
import {
  AlertDialogRoot,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogTrigger,
} from "@/ui/alert-dialog";
import { ActionButton } from "@/ui/action-button";
import { TextField, TextFieldInput } from "@/ui/text-field";
import { DataPageShell } from "../ui/DataPageShell";
import { Snackbar, SnackbarProvider, useSnackbarAdapter } from "@/ui/snackbar";
import {
  createSeasonAction,
  updateSeasonAction,
  deleteSeasonAction,
  reorderSeasonsAction,
  createEpisodeAction,
  updateEpisodeAction,
  deleteEpisodeAction,
  reorderEpisodesAction,
  createContentAction,
  updateContentAction,
  deleteContentAction,
  reorderContentsAction,
  createContentSourceAction,
  updateContentSourceAction,
  deleteContentSourceAction,
  reorderContentSourcesAction,
} from "@/app/admin/actions/catalog";
import type {
  AdminSeason,
  AdminEpisode,
  AdminContent,
  AdminContentSource,
} from "@/lib/admin/catalog-types";
import { safeHttpHref } from "@/lib/safe-url";
import type { ContentType } from "@/types";
import type { CategoryOverrideValue } from "@/types";
import { CsvPanel } from "./CsvPanel";

////////////////////////////////////////////////////////////////////////////////////
// Constants

const CONTENT_TYPES: ContentType[] = [
  "story", "fesxlive", "fesxrec", "music", "withxmeets", "special", "unavailable",
];

const CATEGORY_OVERRIDE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "없음 (auto)" },
  { value: "story", label: "story" },
  { value: "music", label: "music" },
  { value: "fesxlive", label: "fesxlive" },
  { value: "fesxrec", label: "fesxrec" },
  { value: "withxmeets", label: "withxmeets" },
];

const TYPE_COLORS: Record<ContentType, { bg: string; fg: string }> = {
  story:      { bg: "var(--seed-color-bg-brand-weak)",        fg: "var(--seed-color-fg-brand)" },
  fesxlive:   { bg: "var(--seed-color-bg-positive-weak)",     fg: "var(--seed-color-fg-positive)" },
  fesxrec:    { bg: "var(--seed-color-bg-positive-weak)",     fg: "var(--seed-color-fg-positive)" },
  music:      { bg: "var(--seed-color-bg-warning-weak)",      fg: "var(--seed-color-fg-warning)" },
  withxmeets: { bg: "var(--seed-color-bg-informative-weak)",  fg: "var(--seed-color-fg-informative)" },
  special:    { bg: "var(--seed-color-bg-neutral-weak)",      fg: "var(--seed-color-fg-neutral-subtle)" },
  unavailable:{ bg: "var(--seed-color-bg-critical-weak)",     fg: "var(--seed-color-fg-critical)" },
};

////////////////////////////////////////////////////////////////////////////////////
// Design tokens (inline styles using seed CSS vars)

const T = {
  // Typography
  monoFamily: "'Geist Mono', 'SF Mono', ui-monospace, monospace",
  // Table row height — dense data-tool (~34px)
  rowMinH: "34px",
} as const;

////////////////////////////////////////////////////////////////////////////////////
// TypeBadge

function TypeBadge({ type }: { type: ContentType }) {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.special;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: "5px",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.02em",
        backgroundColor: c.bg,
        color: c.fg,
        whiteSpace: "nowrap",
        flexShrink: 0,
        fontFamily: T.monoFamily,
      }}
    >
      {type}
    </span>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// ReorderButtons

function ReorderButtons({
  onUp, onDown, isFirst, isLast, pending,
}: {
  onUp: () => void;
  onDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  pending: boolean;
}) {
  return (
    <span
      style={{ display: "inline-flex", gap: "1px", flexShrink: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      <ActionButton
        variant="ghost" size="xsmall" aria-label="위로"
        disabled={isFirst || pending} onClick={onUp}
        style={{ color: "var(--seed-color-fg-neutral-subtle)" }}
      >↑</ActionButton>
      <ActionButton
        variant="ghost" size="xsmall" aria-label="아래로"
        disabled={isLast || pending} onClick={onDown}
        style={{ color: "var(--seed-color-fg-neutral-subtle)" }}
      >↓</ActionButton>
    </span>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// NativeSelect

function NativeSelect({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--seed-color-fg-neutral)" }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "10px 12px",
          borderRadius: "8px",
          border: "1px solid var(--seed-color-stroke-neutral-subtle)",
          backgroundColor: "var(--seed-color-bg-layer-default)",
          color: "var(--seed-color-fg-neutral)",
          fontSize: "14px",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// SimpleDrawer

interface DrawerField {
  name: string;
  label: string;
  value: string;
  readOnly?: boolean;
  inputType?: "text" | "number";
}

function SimpleDrawer({
  title, fields, onChange, onSubmit, pending, trigger, submitLabel = "저장",
}: {
  title: string;
  fields: DrawerField[];
  onChange: (name: string, value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  trigger: React.ReactNode;
  submitLabel?: string;
}) {
  return (
    <BottomSheetRoot>
      <BottomSheetTrigger asChild>{trigger}</BottomSheetTrigger>
      <BottomSheetContent title={title} showHandle>
        <BottomSheetBody>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "8px 0" }}>
            {fields.map((f) => (
              <TextField key={f.name} label={f.label} readOnly={f.readOnly} aria-label={f.label}>
                <TextFieldInput
                  type={f.inputType ?? "text"}
                  value={f.value}
                  readOnly={f.readOnly}
                  onChange={(e) => !f.readOnly && onChange(f.name, e.target.value)}
                />
              </TextField>
            ))}
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <ActionButton
            variant="brandSolid" size="medium"
            style={{ width: "100%" }}
            loading={pending} disabled={pending}
            onClick={onSubmit}
          >
            {submitLabel}
          </ActionButton>
        </BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheetRoot>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// DeleteConfirm

function DeleteConfirm({
  trigger, title, description, onConfirm, pending,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <AlertDialogRoot>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction variant="neutralOutline" size="medium" style={{ flex: 1 }}>
            취소
          </AlertDialogAction>
          <AlertDialogAction
            variant="criticalSolid" size="medium"
            style={{ flex: 1 }}
            loading={pending} disabled={pending}
            onClick={onConfirm}
          >
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialogRoot>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// useErrorSnackbar

function useErrorSnackbar() {
  const adapter = useSnackbarAdapter();
  return React.useCallback(
    (msg: string) => {
      adapter.create({ render: () => <Snackbar variant="critical" message={msg} /> });
    },
    [adapter],
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Table primitives

function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ overflowX: "auto", width: "100%" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "13px",
          color: "var(--seed-color-fg-neutral)",
          tableLayout: "fixed",
        }}
      >
        {children}
      </table>
    </div>
  );
}

function Th({
  children,
  width,
  align = "left",
}: {
  children?: React.ReactNode;
  width?: string | number;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      style={{
        padding: "0 12px",
        height: "34px",
        textAlign: align,
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--seed-color-fg-neutral-subtle)",
        backgroundColor: "var(--seed-color-bg-neutral-weak)",
        borderBottom: "1px solid var(--seed-color-stroke-neutral-subtle)",
        whiteSpace: "nowrap",
        width: width,
        position: "sticky",
        top: 0,
        zIndex: 1,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  subtle,
  align,
  mono,
  truncate,
  style: extraStyle,
}: {
  children?: React.ReactNode;
  subtle?: boolean;
  align?: "left" | "right" | "center";
  mono?: boolean;
  truncate?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        padding: "0 12px",
        height: T.rowMinH,
        verticalAlign: "middle",
        textAlign: align ?? "left",
        color: subtle ? "var(--seed-color-fg-neutral-subtle)" : undefined,
        fontFamily: mono ? T.monoFamily : undefined,
        fontSize: mono ? "11px" : undefined,
        ...(truncate
          ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
          : undefined),
        ...extraStyle,
      }}
    >
      {children}
    </td>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// DrillRow — a table row that can be clicked to drill in

function DrillRow({
  children,
  onClick,
  stopRow,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  stopRow?: boolean;
}) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: onClick ? "pointer" : "default",
        backgroundColor: hovered && onClick
          ? "var(--seed-color-bg-neutral-weak)"
          : "transparent",
        borderBottom: "1px solid var(--seed-color-stroke-neutral-subtle)",
        transition: "background-color 80ms ease",
      }}
    >
      {children}
    </tr>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// ActionsCell — stopPropagation wrapper so row-click doesn't trigger

function ActionsCell({ children }: { children: React.ReactNode }) {
  return (
    <Td align="right">
      <span
        style={{ display: "inline-flex", gap: "4px", justifyContent: "flex-end" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </span>
    </Td>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Breadcrumb

type Level = 0 | 1 | 2 | 3;

interface BreadcrumbProps {
  season: AdminSeason | null;
  episode: AdminEpisode | null;
  content: AdminContent | null;
  onNavigate: (level: Level) => void;
}

function Breadcrumb({ season, episode, content, onNavigate }: BreadcrumbProps) {
  const crumbs: Array<{ label: string; level: Level; active: boolean }> = [
    { label: "카탈로그", level: 0, active: !season },
  ];
  if (season) crumbs.push({ label: season.name, level: 1, active: !episode });
  if (episode) crumbs.push({ label: `EP ${episode.episode_number}`, level: 2, active: !content });
  if (content) crumbs.push({ label: content.title_ko ?? content.title_jp ?? content.id, level: 3, active: true });

  return (
    <nav aria-label="breadcrumb" style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
      {crumbs.map((c, i) => (
        <React.Fragment key={c.level}>
          {i > 0 && (
            <span style={{ color: "var(--seed-color-fg-neutral-subtle)", fontSize: "13px", userSelect: "none" }}>
              ›
            </span>
          )}
          {c.active ? (
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--seed-color-fg-neutral)",
              }}
            >
              {c.label}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate(c.level)}
              style={{
                background: "none",
                border: "none",
                padding: "2px 4px",
                cursor: "pointer",
                fontSize: "13px",
                color: "var(--seed-color-fg-brand)",
                borderRadius: "4px",
              }}
            >
              {c.label}
            </button>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Toolbar

function Toolbar({
  searchValue,
  onSearchChange,
  addButton,
  levelLabel,
}: {
  searchValue: string;
  onSearchChange: (v: string) => void;
  addButton: React.ReactNode;
  levelLabel: string;
}) {
  // flush 툴바: 자체 카드/테두리 없음(DataPageShell toolbar 슬롯이 하단 border 제공).
  // 카운트는 TopBar의 counts 슬롯으로 올라갔다.
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "8px 12px",
        flexWrap: "wrap",
      }}
    >
      {/* Search */}
      <div style={{ flex: "1 1 200px", minWidth: "160px", maxWidth: "320px" }}>
        <TextField aria-label={`${levelLabel} 검색`}>
          <TextFieldInput
            type="text"
            placeholder={`${levelLabel} 검색…`}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </TextField>
      </div>

      <div style={{ flex: 1 }} />

      {/* Add button */}
      <div style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        {addButton}
      </div>
    </div>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Empty state

function EmptyState({ label }: { label: string }) {
  return (
    <tr>
      <td
        colSpan={99}
        style={{
          padding: "48px 24px",
          textAlign: "center",
          color: "var(--seed-color-fg-neutral-subtle)",
          fontSize: "13px",
        }}
      >
        {label}
      </td>
    </tr>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// ChildCountBadge

function ChildCountBadge({ count, unit }: { count: number; unit: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        padding: "2px 8px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: 500,
        backgroundColor: "var(--seed-color-bg-neutral-weak)",
        color: "var(--seed-color-fg-neutral-subtle)",
        whiteSpace: "nowrap",
      }}
    >
      {unit} {count}
    </span>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Level 0: Seasons table

interface SeasonsTableProps {
  seasons: AdminSeason[];
  onSeasonsChange: (s: AdminSeason[]) => void;
  onDrillIn: (season: AdminSeason) => void;
  topBar: React.ReactNode;
}

function SeasonsTable({ seasons, onSeasonsChange, onDrillIn, topBar }: SeasonsTableProps) {
  const [search, setSearch] = React.useState("");
  const [newSId, setNewSId] = React.useState("");
  const [newSName, setNewSName] = React.useState("");
  const [addPending, startAdd] = React.useTransition();
  const showError = useErrorSnackbar();

  const filtered = React.useMemo(() =>
    search.trim()
      ? seasons.filter(
          (s) =>
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.id.toLowerCase().includes(search.toLowerCase()),
        )
      : seasons,
    [seasons, search],
  );

  function handleAdd() {
    startAdd(async () => {
      try {
        const row = await createSeasonAction({ id: newSId, name: newSName, sort_order: 0 });
        if (!row) return;
        const serverRow = row as Omit<AdminSeason, "episodes">;
        const newSeason: AdminSeason = { ...serverRow, episodes: [] };
        onSeasonsChange([...seasons, newSeason]);
        setNewSId("");
        setNewSName("");
      } catch {
        showError("시즌 추가에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }

  const addButton = (
    <SimpleDrawer
      title="시즌 추가"
      fields={[
        { name: "id", label: "ID (예: 103-main)", value: newSId },
        { name: "name", label: "이름", value: newSName },
      ]}
      onChange={(name, value) => {
        if (name === "id") setNewSId(value);
        else if (name === "name") setNewSName(value);
      }}
      onSubmit={handleAdd}
      pending={addPending}
      submitLabel="추가"
      trigger={
        <ActionButton variant="brandSolid" size="small">+ 추가</ActionButton>
      }
    />
  );

  return (
    <DataPageShell
      topBar={topBar}
      counts={`시즌 ${filtered.length}개`}
      actions={<CsvPanel />}
      toolbar={
        <Toolbar
          searchValue={search}
          onSearchChange={setSearch}
          levelLabel="시즌"
          addButton={addButton}
        />
      }
    >
      <TableWrapper>
        <colgroup>
          <col style={{ width: "84px" }} />
          <col />
          <col style={{ width: "100px" }} />
          <col style={{ width: "160px" }} />
          <col style={{ width: "120px" }} />
        </colgroup>
        <thead>
          <tr>
            <Th>순서</Th>
            <Th>이름</Th>
            <Th align="center">에피소드</Th>
            <Th>ID</Th>
            <Th align="right">액션</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <EmptyState label="아직 없습니다 — + 추가로 만드세요" />
          ) : (
            filtered.map((season, i) => (
              <SeasonRow
                key={season.id}
                season={season}
                index={seasons.indexOf(season)}
                siblings={seasons}
                onSiblingsChange={onSeasonsChange}
                onDrillIn={onDrillIn}
              />
            ))
          )}
        </tbody>
      </TableWrapper>
    </DataPageShell>
  );
}

function SeasonRow({
  season, index, siblings, onSiblingsChange, onDrillIn,
}: {
  season: AdminSeason;
  index: number;
  siblings: AdminSeason[];
  onSiblingsChange: (s: AdminSeason[]) => void;
  onDrillIn: (s: AdminSeason) => void;
}) {
  const total = siblings.length;
  const [editName, setEditName] = React.useState(season.name);
  const [editPending, startEdit] = React.useTransition();
  const [deletePending, startDelete] = React.useTransition();
  const [reorderPending, startReorder] = React.useTransition();
  const showError = useErrorSnackbar();

  function handleReorder(dir: "up" | "down") {
    const snapshot = siblings;
    const ids = siblings.map((s) => s.id);
    const to = dir === "up" ? index - 1 : index + 1;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    const reordered = ids.map((id) => siblings.find((s) => s.id === id)!);
    onSiblingsChange(reordered);
    startReorder(async () => {
      try { await reorderSeasonsAction(ids); }
      catch { onSiblingsChange(snapshot); showError("시즌 순서 변경에 실패했어요. 다시 시도해 주세요."); }
    });
  }

  function handleSave() {
    const snapshot = siblings;
    startEdit(async () => {
      try {
        await updateSeasonAction(season.id, { name: editName });
        onSiblingsChange(siblings.map((s) => s.id === season.id ? { ...s, name: editName } : s));
      } catch { onSiblingsChange(snapshot); showError("시즌 저장에 실패했어요. 다시 시도해 주세요."); }
    });
  }

  function handleDelete() {
    const snapshot = siblings;
    startDelete(async () => {
      try {
        await deleteSeasonAction(season.id);
        onSiblingsChange(siblings.filter((s) => s.id !== season.id));
      } catch { onSiblingsChange(snapshot); showError("시즌 삭제에 실패했어요. 다시 시도해 주세요."); }
    });
  }

  return (
    <DrillRow onClick={() => onDrillIn(season)}>
      <Td>
        <ReorderButtons
          onUp={() => handleReorder("up")} onDown={() => handleReorder("down")}
          isFirst={index === 0} isLast={index === total - 1} pending={reorderPending}
        />
      </Td>
      <Td truncate>
        <span style={{ fontWeight: 500 }}>{season.name}</span>
      </Td>
      <Td align="center">
        <ChildCountBadge count={season.episodes.length} unit="에피소드" />
      </Td>
      <Td mono subtle truncate>{season.id}</Td>
      <ActionsCell>
        <SimpleDrawer
          title="시즌 편집"
          fields={[{ name: "name", label: "이름", value: editName }]}
          onChange={(_n, v) => setEditName(v)}
          onSubmit={handleSave}
          pending={editPending}
          trigger={
            <ActionButton variant="neutralOutline" size="xsmall" aria-label="시즌 편집">편집</ActionButton>
          }
        />
        <DeleteConfirm
          trigger={
            <ActionButton variant="criticalSolid" size="xsmall" aria-label="시즌 삭제" disabled={deletePending}>삭제</ActionButton>
          }
          title="시즌 삭제"
          description={`시즌 "${season.name}"과 하위 에피소드·콘텐츠·소스를 모두 삭제할까요? (cascade)`}
          onConfirm={handleDelete}
          pending={deletePending}
        />
      </ActionsCell>
    </DrillRow>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Level 1: Episodes table

interface EpisodesTableProps {
  season: AdminSeason;
  onSeasonChange: (updated: AdminSeason) => void;
  onDrillIn: (episode: AdminEpisode) => void;
  topBar: React.ReactNode;
}

function EpisodesTable({ season, onSeasonChange, onDrillIn, topBar }: EpisodesTableProps) {
  const [search, setSearch] = React.useState("");
  const [newEpId, setNewEpId] = React.useState("");
  const [newEpNum, setNewEpNum] = React.useState("");
  const [newEpTitleKo, setNewEpTitleKo] = React.useState("");
  const [newEpTitleJp, setNewEpTitleJp] = React.useState("");
  const [addPending, startAdd] = React.useTransition();
  const showError = useErrorSnackbar();

  const episodes = season.episodes;

  const filtered = React.useMemo(() =>
    search.trim()
      ? episodes.filter(
          (e) =>
            (e.title_ko ?? "").toLowerCase().includes(search.toLowerCase()) ||
            (e.title_jp ?? "").toLowerCase().includes(search.toLowerCase()) ||
            e.id.toLowerCase().includes(search.toLowerCase()),
        )
      : episodes,
    [episodes, search],
  );

  function handleEpisodesChange(updated: AdminEpisode[]) {
    onSeasonChange({ ...season, episodes: updated });
  }

  function handleAdd() {
    startAdd(async () => {
      try {
        const row = await createEpisodeAction({
          id: newEpId,
          season_id: season.id,
          episode_number: Number(newEpNum),
          title_ko: newEpTitleKo || null,
          title_jp: newEpTitleJp || null,
          sort_order: 0,
        });
        if (!row) return;
        const serverRow = row as Omit<AdminEpisode, "contents">;
        const newEp: AdminEpisode = { ...serverRow, contents: [] };
        handleEpisodesChange([...episodes, newEp]);
        setNewEpId(""); setNewEpNum(""); setNewEpTitleKo(""); setNewEpTitleJp("");
      } catch {
        showError("에피소드 추가에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }

  const addButton = (
    <BottomSheetRoot>
      <BottomSheetTrigger asChild>
        <ActionButton variant="brandSolid" size="small">+ 추가</ActionButton>
      </BottomSheetTrigger>
      <BottomSheetContent title="에피소드 추가" showHandle>
        <BottomSheetBody>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "8px 0" }}>
            <TextField label="ID (episode.id)" aria-label="에피소드 ID">
              <TextFieldInput value={newEpId} onChange={(e) => setNewEpId(e.target.value)} />
            </TextField>
            <TextField label="화수" aria-label="화수">
              <TextFieldInput type="number" value={newEpNum} onChange={(e) => setNewEpNum(e.target.value)} />
            </TextField>
            <TextField label="제목 (한국어)" aria-label="제목 한국어">
              <TextFieldInput value={newEpTitleKo} onChange={(e) => setNewEpTitleKo(e.target.value)} />
            </TextField>
            <TextField label="제목 (일본어)" aria-label="제목 일본어">
              <TextFieldInput value={newEpTitleJp} onChange={(e) => setNewEpTitleJp(e.target.value)} />
            </TextField>
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <ActionButton
            variant="brandSolid" size="medium" style={{ width: "100%" }}
            loading={addPending} disabled={addPending} onClick={handleAdd}
          >추가</ActionButton>
        </BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheetRoot>
  );

  return (
    <DataPageShell
      topBar={topBar}
      counts={`에피소드 ${filtered.length}개`}
      toolbar={
        <Toolbar
          searchValue={search}
          onSearchChange={setSearch}
          levelLabel="에피소드"
          addButton={addButton}
        />
      }
    >
      <TableWrapper>
        <colgroup>
          <col style={{ width: "84px" }} />
          <col style={{ width: "60px" }} />
          <col />
          <col style={{ width: "100px" }} />
          <col style={{ width: "160px" }} />
          <col style={{ width: "120px" }} />
        </colgroup>
        <thead>
          <tr>
            <Th>순서</Th>
            <Th>화수</Th>
            <Th>제목</Th>
            <Th align="center">콘텐츠</Th>
            <Th>ID</Th>
            <Th align="right">액션</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <EmptyState label="아직 없습니다 — + 추가로 만드세요" />
          ) : (
            filtered.map((episode) => (
              <EpisodeRow
                key={episode.id}
                episode={episode}
                index={episodes.indexOf(episode)}
                siblings={episodes}
                onSiblingsChange={handleEpisodesChange}
                onDrillIn={onDrillIn}
              />
            ))
          )}
        </tbody>
      </TableWrapper>
    </DataPageShell>
  );
}

function EpisodeRow({
  episode, index, siblings, onSiblingsChange, onDrillIn,
}: {
  episode: AdminEpisode;
  index: number;
  siblings: AdminEpisode[];
  onSiblingsChange: (e: AdminEpisode[]) => void;
  onDrillIn: (e: AdminEpisode) => void;
}) {
  const total = siblings.length;
  const seasonId = episode.season_id;
  const [editEpNum, setEditEpNum] = React.useState(String(episode.episode_number));
  const [editTitleKo, setEditTitleKo] = React.useState(episode.title_ko ?? "");
  const [editTitleJp, setEditTitleJp] = React.useState(episode.title_jp ?? "");
  const [editPending, startEdit] = React.useTransition();
  const [deletePending, startDelete] = React.useTransition();
  const [reorderPending, startReorder] = React.useTransition();
  const showError = useErrorSnackbar();

  function handleReorder(dir: "up" | "down") {
    const snapshot = siblings;
    const ids = siblings.map((e) => e.id);
    const to = dir === "up" ? index - 1 : index + 1;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    const reordered = ids.map((id) => siblings.find((e) => e.id === id)!);
    onSiblingsChange(reordered);
    startReorder(async () => {
      try { await reorderEpisodesAction(seasonId, ids); }
      catch { onSiblingsChange(snapshot); showError("에피소드 순서 변경에 실패했어요. 다시 시도해 주세요."); }
    });
  }

  function handleSave() {
    const snapshot = siblings;
    startEdit(async () => {
      try {
        await updateEpisodeAction(episode.id, {
          episode_number: Number(editEpNum),
          title_ko: editTitleKo || null,
          title_jp: editTitleJp || null,
        });
        onSiblingsChange(siblings.map((e) =>
          e.id === episode.id
            ? { ...e, episode_number: Number(editEpNum), title_ko: editTitleKo || null, title_jp: editTitleJp || null }
            : e,
        ));
      } catch { onSiblingsChange(snapshot); showError("에피소드 저장에 실패했어요. 다시 시도해 주세요."); }
    });
  }

  function handleDelete() {
    const snapshot = siblings;
    startDelete(async () => {
      try {
        await deleteEpisodeAction(episode.id);
        onSiblingsChange(siblings.filter((e) => e.id !== episode.id));
      } catch { onSiblingsChange(snapshot); showError("에피소드 삭제에 실패했어요. 다시 시도해 주세요."); }
    });
  }

  return (
    <DrillRow onClick={() => onDrillIn(episode)}>
      <Td>
        <ReorderButtons
          onUp={() => handleReorder("up")} onDown={() => handleReorder("down")}
          isFirst={index === 0} isLast={index === total - 1} pending={reorderPending}
        />
      </Td>
      <Td mono>{episode.episode_number}화</Td>
      <Td truncate>
        <span style={{ fontWeight: 500 }}>
          {episode.title_ko ?? episode.title_jp ?? "—"}
        </span>
        {episode.title_ko && episode.title_jp && (
          <span style={{ fontSize: "11px", color: "var(--seed-color-fg-neutral-subtle)", marginLeft: "6px" }}>
            {episode.title_jp}
          </span>
        )}
      </Td>
      <Td align="center">
        <ChildCountBadge count={episode.contents.length} unit="콘텐츠" />
      </Td>
      <Td mono subtle truncate>{episode.id}</Td>
      <ActionsCell>
        <SimpleDrawer
          title="에피소드 편집"
          fields={[
            { name: "episode_number", label: "화수", value: editEpNum, inputType: "number" },
            { name: "title_ko", label: "제목 (한국어)", value: editTitleKo },
            { name: "title_jp", label: "제목 (일본어)", value: editTitleJp },
          ]}
          onChange={(name, value) => {
            if (name === "episode_number") setEditEpNum(value);
            else if (name === "title_ko") setEditTitleKo(value);
            else if (name === "title_jp") setEditTitleJp(value);
          }}
          onSubmit={handleSave}
          pending={editPending}
          trigger={
            <ActionButton variant="neutralOutline" size="xsmall" aria-label="에피소드 편집">편집</ActionButton>
          }
        />
        <DeleteConfirm
          trigger={
            <ActionButton variant="criticalSolid" size="xsmall" aria-label="에피소드 삭제" disabled={deletePending}>삭제</ActionButton>
          }
          title="에피소드 삭제"
          description={`에피소드 "${episode.title_ko ?? episode.id}"과 하위 콘텐츠·소스를 모두 삭제할까요? (cascade)`}
          onConfirm={handleDelete}
          pending={deletePending}
        />
      </ActionsCell>
    </DrillRow>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Level 2: Contents table

interface ContentsTableProps {
  episode: AdminEpisode;
  onEpisodeChange: (updated: AdminEpisode) => void;
  onDrillIn: (content: AdminContent) => void;
}

function ContentsTable({ episode, onEpisodeChange, onDrillIn }: ContentsTableProps) {
  const [search, setSearch] = React.useState("");
  const [newCId, setNewCId] = React.useState("");
  const [newCType, setNewCType] = React.useState<ContentType>("story");
  const [newCTitleKo, setNewCTitleKo] = React.useState("");
  const [newCTitleJp, setNewCTitleJp] = React.useState("");
  const [newCPartLabel, setNewCPartLabel] = React.useState("");
  const [newCLegacyId, setNewCLegacyId] = React.useState("");
  const [addPending, startAdd] = React.useTransition();
  const showError = useErrorSnackbar();

  const contents = episode.contents;

  const filtered = React.useMemo(() =>
    search.trim()
      ? contents.filter(
          (c) =>
            (c.title_ko ?? "").toLowerCase().includes(search.toLowerCase()) ||
            (c.title_jp ?? "").toLowerCase().includes(search.toLowerCase()) ||
            c.id.toLowerCase().includes(search.toLowerCase()),
        )
      : contents,
    [contents, search],
  );

  function handleContentsChange(updated: AdminContent[]) {
    onEpisodeChange({ ...episode, contents: updated });
  }

  function handleAdd() {
    startAdd(async () => {
      try {
        const row = await createContentAction({
          id: newCId,
          episode_id: episode.id,
          type: newCType,
          title_ko: newCTitleKo || null,
          title_jp: newCTitleJp || null,
          part_label: newCPartLabel || null,
          legacy_video_id: newCLegacyId,
          sort_order: 0,
        });
        if (!row) return;
        const serverRow = row as Omit<AdminContent, "content_sources">;
        const newContent: AdminContent = { ...serverRow, content_sources: [] };
        handleContentsChange([...contents, newContent]);
        setNewCId(""); setNewCType("story"); setNewCTitleKo(""); setNewCTitleJp("");
        setNewCPartLabel(""); setNewCLegacyId("");
      } catch {
        showError("콘텐츠 추가에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }

  return (
    <>
      <Toolbar
        searchValue={search}
        onSearchChange={setSearch}
        levelLabel="콘텐츠"
        addButton={
          <BottomSheetRoot>
            <BottomSheetTrigger asChild>
              <ActionButton variant="brandSolid" size="small">+ 추가</ActionButton>
            </BottomSheetTrigger>
            <BottomSheetContent title="콘텐츠 추가" showHandle>
              <BottomSheetBody>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "8px 0" }}>
                  <TextField label="ID (content.id)" aria-label="콘텐츠 ID">
                    <TextFieldInput value={newCId} onChange={(e) => setNewCId(e.target.value)} />
                  </TextField>
                  <NativeSelect
                    label="타입" value={newCType}
                    options={CONTENT_TYPES.map((t) => ({ value: t, label: t }))}
                    onChange={(v) => setNewCType(v as ContentType)}
                  />
                  <TextField label="제목 (한국어)" aria-label="제목 한국어">
                    <TextFieldInput value={newCTitleKo} onChange={(e) => setNewCTitleKo(e.target.value)} />
                  </TextField>
                  <TextField label="제목 (일본어)" aria-label="제목 일본어">
                    <TextFieldInput value={newCTitleJp} onChange={(e) => setNewCTitleJp(e.target.value)} />
                  </TextField>
                  <TextField label="파트 레이블" aria-label="파트 레이블">
                    <TextFieldInput value={newCPartLabel} onChange={(e) => setNewCPartLabel(e.target.value)} />
                  </TextField>
                  <TextField label="legacy_video_id" aria-label="legacy_video_id">
                    <TextFieldInput value={newCLegacyId} onChange={(e) => setNewCLegacyId(e.target.value)} />
                  </TextField>
                </div>
              </BottomSheetBody>
              <BottomSheetFooter>
                <ActionButton
                  variant="brandSolid" size="medium" style={{ width: "100%" }}
                  loading={addPending} disabled={addPending} onClick={handleAdd}
                >추가</ActionButton>
              </BottomSheetFooter>
            </BottomSheetContent>
          </BottomSheetRoot>
        }
      />
      <TableWrapper>
        <colgroup>
          <col style={{ width: "84px" }} />
          <col style={{ width: "110px" }} />
          <col />
          <col style={{ width: "80px" }} />
          <col style={{ width: "100px" }} />
          <col style={{ width: "90px" }} />
          <col style={{ width: "160px" }} />
          <col style={{ width: "120px" }} />
        </colgroup>
        <thead>
          <tr>
            <Th>순서</Th>
            <Th>타입</Th>
            <Th>제목</Th>
            <Th>파트</Th>
            <Th>카테고리</Th>
            <Th align="center">소스</Th>
            <Th>ID</Th>
            <Th align="right">액션</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <EmptyState label="아직 없습니다 — + 추가로 만드세요" />
          ) : (
            filtered.map((content) => (
              <ContentRow
                key={content.id}
                content={content}
                index={contents.indexOf(content)}
                siblings={contents}
                onSiblingsChange={handleContentsChange}
                onDrillIn={onDrillIn}
              />
            ))
          )}
        </tbody>
      </TableWrapper>
    </>
  );
}

function ContentRow({
  content, index, siblings, onSiblingsChange, onDrillIn,
}: {
  content: AdminContent;
  index: number;
  siblings: AdminContent[];
  onSiblingsChange: (c: AdminContent[]) => void;
  onDrillIn: (c: AdminContent) => void;
}) {
  const total = siblings.length;
  const episodeId = content.episode_id;
  const [editType, setEditType] = React.useState<ContentType>(content.type);
  const [editCatOverride, setEditCatOverride] = React.useState<string>(content.category_override ?? "");
  const [editTitleKo, setEditTitleKo] = React.useState(content.title_ko ?? "");
  const [editTitleJp, setEditTitleJp] = React.useState(content.title_jp ?? "");
  const [editPartLabel, setEditPartLabel] = React.useState(content.part_label ?? "");
  const [editPending, startEdit] = React.useTransition();
  const [deletePending, startDelete] = React.useTransition();
  const [reorderPending, startReorder] = React.useTransition();
  const showError = useErrorSnackbar();

  function handleReorder(dir: "up" | "down") {
    const snapshot = siblings;
    const ids = siblings.map((c) => c.id);
    const to = dir === "up" ? index - 1 : index + 1;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    const reordered = ids.map((id) => siblings.find((c) => c.id === id)!);
    onSiblingsChange(reordered);
    startReorder(async () => {
      try { await reorderContentsAction(episodeId, ids); }
      catch { onSiblingsChange(snapshot); showError("콘텐츠 순서 변경에 실패했어요. 다시 시도해 주세요."); }
    });
  }

  function handleSave() {
    const category_override: CategoryOverrideValue =
      editCatOverride === "" ? null : (editCatOverride as CategoryOverrideValue);
    const snapshot = siblings;
    startEdit(async () => {
      try {
        await updateContentAction(content.id, {
          type: editType,
          title_ko: editTitleKo || null,
          title_jp: editTitleJp || null,
          part_label: editPartLabel || null,
          category_override,
        });
        onSiblingsChange(siblings.map((c) =>
          c.id === content.id
            ? { ...c, type: editType, title_ko: editTitleKo || null, title_jp: editTitleJp || null, part_label: editPartLabel || null, category_override }
            : c,
        ));
      } catch { onSiblingsChange(snapshot); showError("콘텐츠 저장에 실패했어요. 다시 시도해 주세요."); }
    });
  }

  function handleDelete() {
    const snapshot = siblings;
    startDelete(async () => {
      try {
        await deleteContentAction(content.id);
        onSiblingsChange(siblings.filter((c) => c.id !== content.id));
      } catch { onSiblingsChange(snapshot); showError("콘텐츠 삭제에 실패했어요. 다시 시도해 주세요."); }
    });
  }

  return (
    <DrillRow onClick={() => onDrillIn(content)}>
      <Td>
        <ReorderButtons
          onUp={() => handleReorder("up")} onDown={() => handleReorder("down")}
          isFirst={index === 0} isLast={index === total - 1} pending={reorderPending}
        />
      </Td>
      <Td><TypeBadge type={content.type} /></Td>
      <Td truncate>
        <span style={{ fontWeight: 500 }}>
          {content.title_ko ?? content.title_jp ?? "—"}
        </span>
        {content.title_ko && content.title_jp && (
          <span style={{ fontSize: "11px", color: "var(--seed-color-fg-neutral-subtle)", marginLeft: "6px" }}>
            {content.title_jp}
          </span>
        )}
      </Td>
      <Td subtle>{content.part_label ?? "—"}</Td>
      <Td subtle mono>{content.category_override ?? "—"}</Td>
      <Td align="center">
        <ChildCountBadge count={content.content_sources.length} unit="소스" />
      </Td>
      <Td mono subtle truncate>{content.id}</Td>
      <ActionsCell>
        {/* 콘텐츠 편집 드로어 (NativeSelect 포함이라 inline) */}
        <BottomSheetRoot>
          <BottomSheetTrigger asChild>
            <ActionButton variant="neutralOutline" size="xsmall" aria-label="콘텐츠 편집">편집</ActionButton>
          </BottomSheetTrigger>
          <BottomSheetContent title="콘텐츠 편집" showHandle>
            <BottomSheetBody>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "8px 0" }}>
                <TextField label="legacy_video_id (읽기 전용)" readOnly aria-label="legacy_video_id">
                  <TextFieldInput value={content.legacy_video_id} readOnly />
                </TextField>
                <NativeSelect
                  label="타입" value={editType}
                  options={CONTENT_TYPES.map((t) => ({ value: t, label: t }))}
                  onChange={(v) => setEditType(v as ContentType)}
                />
                <TextField label="제목 (한국어)" aria-label="제목 한국어">
                  <TextFieldInput value={editTitleKo} onChange={(e) => setEditTitleKo(e.target.value)} />
                </TextField>
                <TextField label="제목 (일본어)" aria-label="제목 일본어">
                  <TextFieldInput value={editTitleJp} onChange={(e) => setEditTitleJp(e.target.value)} />
                </TextField>
                <TextField label="파트 레이블" aria-label="파트 레이블">
                  <TextFieldInput value={editPartLabel} onChange={(e) => setEditPartLabel(e.target.value)} />
                </TextField>
                <NativeSelect
                  label="카테고리 오버라이드" value={editCatOverride}
                  options={CATEGORY_OVERRIDE_OPTIONS}
                  onChange={setEditCatOverride}
                />
              </div>
            </BottomSheetBody>
            <BottomSheetFooter>
              <ActionButton
                variant="brandSolid" size="medium" style={{ width: "100%" }}
                loading={editPending} disabled={editPending} onClick={handleSave}
              >저장</ActionButton>
            </BottomSheetFooter>
          </BottomSheetContent>
        </BottomSheetRoot>
        <DeleteConfirm
          trigger={
            <ActionButton variant="criticalSolid" size="xsmall" aria-label="콘텐츠 삭제" disabled={deletePending}>삭제</ActionButton>
          }
          title="콘텐츠 삭제"
          description={`"${content.title_ko ?? content.id}" 을(를) 삭제할까요?\n⚠️ legacy_video_id(${content.legacy_video_id})를 참조하는 user_progress 기록이 고아(orphan)가 됩니다. FK가 없어 자동 정리되지 않습니다.`}
          onConfirm={handleDelete}
          pending={deletePending}
        />
      </ActionsCell>
    </DrillRow>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Level 3: Sources table (leaf)

interface SourcesTableProps {
  content: AdminContent;
  onContentChange: (updated: AdminContent) => void;
  topBar: React.ReactNode;
}

function SourcesTable({ content, onContentChange, topBar }: SourcesTableProps) {
  const [search, setSearch] = React.useState("");
  const [newSrcUrl, setNewSrcUrl] = React.useState("");
  const [newSrcLabel, setNewSrcLabel] = React.useState("");
  const [newSrcTimestamp, setNewSrcTimestamp] = React.useState("false");
  const [addPending, startAdd] = React.useTransition();
  const showError = useErrorSnackbar();

  const sources = content.content_sources;

  const filtered = React.useMemo(() =>
    search.trim()
      ? sources.filter(
          (s) =>
            (s.label ?? "").toLowerCase().includes(search.toLowerCase()) ||
            s.url.toLowerCase().includes(search.toLowerCase()),
        )
      : sources,
    [sources, search],
  );

  function handleSourcesChange(updated: AdminContentSource[]) {
    onContentChange({ ...content, content_sources: updated });
  }

  function handleAdd() {
    startAdd(async () => {
      try {
        const row = await createContentSourceAction({
          content_id: content.id,
          url: newSrcUrl,
          label: newSrcLabel || null,
          timestamp_todo: newSrcTimestamp === "true",
          sort_order: 0,
        });
        if (!row) return;
        const newSrc = row as AdminContentSource;
        handleSourcesChange([...sources, newSrc]);
        setNewSrcUrl(""); setNewSrcLabel(""); setNewSrcTimestamp("false");
      } catch {
        showError("소스 추가에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }

  const addButton = (
    <SimpleDrawer
      title="소스 추가"
      fields={[
        { name: "url", label: "URL", value: newSrcUrl },
        { name: "label", label: "레이블", value: newSrcLabel },
        { name: "timestamp_todo", label: "timestamp 미정 (true/false)", value: newSrcTimestamp },
      ]}
      onChange={(name, value) => {
        if (name === "url") setNewSrcUrl(value);
        else if (name === "label") setNewSrcLabel(value);
        else if (name === "timestamp_todo") setNewSrcTimestamp(value);
      }}
      onSubmit={handleAdd}
      pending={addPending}
      submitLabel="추가"
      trigger={
        <ActionButton variant="brandSolid" size="small">+ 추가</ActionButton>
      }
    />
  );

  return (
    <DataPageShell
      topBar={topBar}
      counts={`소스 ${filtered.length}개`}
      toolbar={
        <Toolbar
          searchValue={search}
          onSearchChange={setSearch}
          levelLabel="소스"
          addButton={addButton}
        />
      }
    >
      <TableWrapper>
        <colgroup>
          <col style={{ width: "84px" }} />
          <col style={{ width: "120px" }} />
          <col />
          <col style={{ width: "100px" }} />
          <col style={{ width: "120px" }} />
        </colgroup>
        <thead>
          <tr>
            <Th>순서</Th>
            <Th>레이블</Th>
            <Th>URL</Th>
            <Th align="center">timestamp_todo</Th>
            <Th align="right">액션</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <EmptyState label="아직 없습니다 — + 추가로 만드세요" />
          ) : (
            filtered.map((source) => (
              <SourceRow
                key={source.id}
                source={source}
                index={sources.indexOf(source)}
                siblings={sources}
                onSiblingsChange={handleSourcesChange}
              />
            ))
          )}
        </tbody>
      </TableWrapper>
    </DataPageShell>
  );
}

function SourceRow({
  source, index, siblings, onSiblingsChange,
}: {
  source: AdminContentSource;
  index: number;
  siblings: AdminContentSource[];
  onSiblingsChange: (s: AdminContentSource[]) => void;
}) {
  const total = siblings.length;
  const contentId = source.content_id;
  const [editUrl, setEditUrl] = React.useState(source.url);
  const [editLabel, setEditLabel] = React.useState(source.label ?? "");
  const [editTimestamp, setEditTimestamp] = React.useState(source.timestamp_todo ? "true" : "false");
  const [editPending, startEdit] = React.useTransition();
  const [deletePending, startDelete] = React.useTransition();
  const [reorderPending, startReorder] = React.useTransition();
  const showError = useErrorSnackbar();

  function handleReorder(dir: "up" | "down") {
    const snapshot = siblings;
    const ids = siblings.map((s) => s.id);
    const to = dir === "up" ? index - 1 : index + 1;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    const reordered = ids.map((id) => siblings.find((s) => s.id === id)!);
    onSiblingsChange(reordered);
    startReorder(async () => {
      try { await reorderContentSourcesAction(contentId, ids); }
      catch { onSiblingsChange(snapshot); showError("소스 순서 변경에 실패했어요. 다시 시도해 주세요."); }
    });
  }

  function handleSave() {
    const snapshot = siblings;
    startEdit(async () => {
      try {
        await updateContentSourceAction(source.id, {
          url: editUrl,
          label: editLabel || null,
          timestamp_todo: editTimestamp === "true",
        });
        onSiblingsChange(siblings.map((s) =>
          s.id === source.id
            ? { ...s, url: editUrl, label: editLabel || null, timestamp_todo: editTimestamp === "true" }
            : s,
        ));
      } catch { onSiblingsChange(snapshot); showError("소스 저장에 실패했어요. 다시 시도해 주세요."); }
    });
  }

  function handleDelete() {
    const snapshot = siblings;
    startDelete(async () => {
      try {
        await deleteContentSourceAction(source.id);
        onSiblingsChange(siblings.filter((s) => s.id !== source.id));
      } catch { onSiblingsChange(snapshot); showError("소스 삭제에 실패했어요. 다시 시도해 주세요."); }
    });
  }

  const safeHref = safeHttpHref(source.url);

  return (
    <DrillRow>
      <Td>
        <ReorderButtons
          onUp={() => handleReorder("up")} onDown={() => handleReorder("down")}
          isFirst={index === 0} isLast={index === total - 1} pending={reorderPending}
        />
      </Td>
      <Td subtle>{source.label ?? "—"}</Td>
      <Td truncate>
        {safeHref ? (
          <a
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--seed-color-fg-brand)",
              fontSize: "12px",
              fontFamily: T.monoFamily,
              textDecoration: "none",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {source.url.length > 60 ? source.url.slice(0, 60) + "…" : source.url}
          </a>
        ) : (
          <span style={{ color: "var(--seed-color-fg-neutral-subtle)", fontSize: "12px", fontFamily: T.monoFamily }}>
            {source.url.length > 60 ? source.url.slice(0, 60) + "…" : source.url}
          </span>
        )}
      </Td>
      <Td align="center">
        {source.timestamp_todo ? (
          <span style={{
            display: "inline-block",
            padding: "2px 7px",
            borderRadius: "5px",
            fontSize: "11px",
            fontWeight: 600,
            backgroundColor: "var(--seed-color-bg-warning-weak)",
            color: "var(--seed-color-fg-warning)",
          }}>
            미정
          </span>
        ) : (
          <span style={{ color: "var(--seed-color-fg-neutral-subtle)", fontSize: "12px" }}>—</span>
        )}
      </Td>
      <ActionsCell>
        <SimpleDrawer
          title="소스 편집"
          fields={[
            { name: "url", label: "URL", value: editUrl },
            { name: "label", label: "레이블", value: editLabel },
            { name: "timestamp_todo", label: "timestamp 미정 (true/false)", value: editTimestamp },
          ]}
          onChange={(name, value) => {
            if (name === "url") setEditUrl(value);
            else if (name === "label") setEditLabel(value);
            else if (name === "timestamp_todo") setEditTimestamp(value);
          }}
          onSubmit={handleSave}
          pending={editPending}
          trigger={
            <ActionButton variant="neutralOutline" size="xsmall" aria-label="소스 편집">편집</ActionButton>
          }
        />
        <DeleteConfirm
          trigger={
            <ActionButton variant="criticalSolid" size="xsmall" aria-label="소스 삭제" disabled={deletePending}>삭제</ActionButton>
          }
          title="소스 삭제"
          description="이 소스를 삭제할까요?"
          onConfirm={handleDelete}
          pending={deletePending}
        />
      </ActionsCell>
    </DrillRow>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Main CatalogClient

interface CatalogClientProps {
  initialSeasons: AdminSeason[];
}

function CatalogClientInner({ initialSeasons }: CatalogClientProps) {
  const [seasons, setSeasons] = React.useState<AdminSeason[]>(initialSeasons);

  // Navigation state: IDs of selected season/episode/content
  const [selectedSeasonId, setSelectedSeasonId] = React.useState<string | null>(null);
  const [selectedEpisodeId, setSelectedEpisodeId] = React.useState<string | null>(null);
  const [selectedContentId, setSelectedContentId] = React.useState<string | null>(null);

  // Derived: current level items from the tree
  const selectedSeason = selectedSeasonId
    ? seasons.find((s) => s.id === selectedSeasonId) ?? null
    : null;
  const selectedEpisode = selectedSeason && selectedEpisodeId
    ? selectedSeason.episodes.find((e) => e.id === selectedEpisodeId) ?? null
    : null;
  const selectedContent = selectedEpisode && selectedContentId
    ? selectedEpisode.contents.find((c) => c.id === selectedContentId) ?? null
    : null;

  // Current level: 0=seasons, 1=episodes, 2=contents, 3=sources
  const level: Level =
    selectedContent ? 3 : selectedEpisode ? 2 : selectedSeason ? 1 : 0;

  function navigateToLevel(l: Level) {
    if (l <= 0) { setSelectedSeasonId(null); setSelectedEpisodeId(null); setSelectedContentId(null); }
    else if (l <= 1) { setSelectedEpisodeId(null); setSelectedContentId(null); }
    else if (l <= 2) { setSelectedContentId(null); }
  }

  // Updaters that patch the central seasons tree
  function handleSeasonChange(updated: AdminSeason) {
    setSeasons((prev) => prev.map((s) => s.id === updated.id ? updated : s));
  }

  function handleEpisodeChange(updated: AdminEpisode) {
    setSeasons((prev) =>
      prev.map((s) =>
        s.id === selectedSeasonId
          ? { ...s, episodes: s.episodes.map((e) => e.id === updated.id ? updated : e) }
          : s,
      ),
    );
  }

  function handleContentChange(updated: AdminContent) {
    setSeasons((prev) =>
      prev.map((s) =>
        s.id === selectedSeasonId
          ? {
              ...s,
              episodes: s.episodes.map((e) =>
                e.id === selectedEpisodeId
                  ? { ...e, contents: e.contents.map((c) => c.id === updated.id ? updated : c) }
                  : e,
              ),
            }
          : s,
      ),
    );
  }

  // TopBar 좌측: 서브틀한 뒤로(←) + 브레드크럼. 카운트/추가는 각 레벨이 shell 슬롯에 주입.
  const topBar = (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
      {level > 0 && (
        <ActionButton
          variant="neutralWeak"
          size="xsmall"
          aria-label="뒤로"
          onClick={() => navigateToLevel((level - 1) as Level)}
          style={{ flexShrink: 0, color: "var(--seed-color-fg-neutral-subtle)" }}
        >
          ←
        </ActionButton>
      )}
      <Breadcrumb
        season={selectedSeason}
        episode={selectedEpisode}
        content={selectedContent}
        onNavigate={navigateToLevel}
      />
    </div>
  );

  // 풀-하이트 컨테이너: <main>이 내려준 바운디드 높이를 받아 DataPageShell이 채운다.
  return (
    <div style={{ height: "100%", minHeight: 0, minWidth: 0 }}>
      {level === 0 && (
        <SeasonsTable
          seasons={seasons}
          onSeasonsChange={setSeasons}
          onDrillIn={(s) => setSelectedSeasonId(s.id)}
          topBar={topBar}
        />
      )}
      {level === 1 && selectedSeason && (
        <EpisodesTable
          season={selectedSeason}
          onSeasonChange={handleSeasonChange}
          onDrillIn={(e) => setSelectedEpisodeId(e.id)}
          topBar={topBar}
        />
      )}
      {level === 2 && selectedEpisode && (
        <ContentsGrid
          episode={selectedEpisode}
          onEpisodeChange={handleEpisodeChange}
          onDrillIn={(c) => setSelectedContentId(c.id)}
          topBar={topBar}
        />
      )}
      {level === 3 && selectedContent && (
        <SourcesTable
          content={selectedContent}
          onContentChange={handleContentChange}
          topBar={topBar}
        />
      )}
    </div>
  );
}

export default function CatalogClient({ initialSeasons }: CatalogClientProps) {
  return (
    <SnackbarProvider>
      <CatalogClientInner initialSeasons={initialSeasons} />
    </SnackbarProvider>
  );
}
