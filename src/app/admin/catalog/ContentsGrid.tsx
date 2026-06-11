"use client";

/**
 * ContentsGrid — 콘텐츠(레벨 2) 표. TanStack `DataTable` + `EditableCell` 기반.
 *
 * 옛 rdg 스프레드시트를 걷어내고 공유 DataTable 위에 인라인 편집을 올렸다.
 *   - 편집: EditableCell(자족적). 셀은 onCommit(field, value)만 알리고,
 *     patch 생성/`""→null` 변환/도메인 가드/낙관·롤백은 이 표면(handleCommit)이 소유.
 *   - 순서: ReorderCell — 항상 정규 배열(contentsRef.current)을 id로 조회. 검색 중엔 비활성.
 *   - 콘텐츠는 행 클릭 드릴 미사용(인-셀 "소스" 버튼) → onRowClick 미전달 → 편집/드릴 무충돌.
 *   - enableSorting=false (수동 sort_order가 진실).
 */

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { ActionButton } from "@/ui/action-button";
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
import { TextField, TextFieldInput } from "@/ui/text-field";

import {
  createContentAction,
  updateContentAction,
  deleteContentAction,
  reorderContentsAction,
} from "@/app/admin/actions/catalog";

import type { AdminContent, AdminEpisode } from "@/lib/admin/catalog-types";
import type { ContentType, CategoryOverrideValue } from "@/types";

import { useSnackbarAdapter, Snackbar } from "@/ui/snackbar";
import { DataPageShell } from "../ui/DataPageShell";
import { DataTable, type DataTableColumnMeta } from "../ui/DataTable";
import { EditableTextCell, EditableSelectCell } from "../ui/EditableCell";

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
  story:       { bg: "var(--seed-color-bg-brand-weak)",       fg: "var(--seed-color-fg-brand)" },
  fesxlive:    { bg: "var(--seed-color-bg-positive-weak)",    fg: "var(--seed-color-fg-positive)" },
  fesxrec:     { bg: "var(--seed-color-bg-positive-weak)",    fg: "var(--seed-color-fg-positive)" },
  music:       { bg: "var(--seed-color-bg-warning-weak)",     fg: "var(--seed-color-fg-warning)" },
  withxmeets:  { bg: "var(--seed-color-bg-informative-weak)", fg: "var(--seed-color-fg-informative)" },
  special:     { bg: "var(--seed-color-bg-neutral-weak)",     fg: "var(--seed-color-fg-neutral-subtle)" },
  unavailable: { bg: "var(--seed-color-bg-critical-weak)",    fg: "var(--seed-color-fg-critical)" },
};

const MONO = "'Geist Mono', 'SF Mono', ui-monospace, monospace";

// 표면이 받아 쓰는 편집 필드(도메인 가드 대상은 제외).
type EditableField = "type" | "title_ko" | "title_jp" | "part_label" | "category_override";

////////////////////////////////////////////////////////////////////////////////////
// Local helpers

function useErrorSnackbar() {
  const adapter = useSnackbarAdapter();
  return React.useCallback(
    (msg: string) => {
      adapter.create({ render: () => <Snackbar variant="critical" message={msg} /> });
    },
    [adapter],
  );
}

function TypeBadge({ type }: { type: ContentType }) {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.special;
  return (
    <span
      style={{
        display: "inline-block", padding: "2px 7px", borderRadius: "5px",
        fontSize: "11px", lineHeight: "16px", fontWeight: 600, letterSpacing: "0.02em",
        backgroundColor: c.bg, color: c.fg, whiteSpace: "nowrap", fontFamily: MONO,
        verticalAlign: "middle",
      }}
    >
      {type}
    </span>
  );
}

// 순서 ↑/↓ — 정규 배열 기준. 검색 중엔 disabled(보이는 순서 ≠ 정규 순서라 화살표가 거짓말함).
function ReorderCell({
  row, allRows, onReorder, pending, disabled,
}: {
  row: AdminContent;
  allRows: AdminContent[];
  onReorder: (contentId: string, dir: "up" | "down") => void;
  pending: boolean;
  disabled: boolean;
}) {
  const idx = allRows.findIndex((r) => r.id === row.id);
  const isFirst = idx <= 0;
  const isLast = idx === allRows.length - 1;
  return (
    <span style={{ display: "inline-flex", gap: "1px", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
      <ActionButton variant="ghost" size="xsmall" aria-label="위로"
        disabled={isFirst || pending || disabled}
        onClick={(e) => { e.stopPropagation(); onReorder(row.id, "up"); }}
        style={{ color: "var(--seed-color-fg-neutral-subtle)" }}>↑</ActionButton>
      <ActionButton variant="ghost" size="xsmall" aria-label="아래로"
        disabled={isLast || pending || disabled}
        onClick={(e) => { e.stopPropagation(); onReorder(row.id, "down"); }}
        style={{ color: "var(--seed-color-fg-neutral-subtle)" }}>↓</ActionButton>
    </span>
  );
}

function SourcesCell({ row, onDrillIn }: { row: AdminContent; onDrillIn: (c: AdminContent) => void }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onDrillIn(row); }}
      style={{
        background: "none", border: "none", cursor: "pointer", padding: "2px 8px",
        borderRadius: "20px", fontSize: "11px", fontWeight: 500,
        backgroundColor: "var(--seed-color-bg-neutral-weak)", color: "var(--seed-color-fg-neutral-subtle)",
        whiteSpace: "nowrap", fontFamily: MONO,
      }}>
      소스 {row.content_sources.length}
    </button>
  );
}

function DeleteCell({
  row, siblings, onSiblingsChange, showError,
}: {
  row: AdminContent;
  siblings: AdminContent[];
  onSiblingsChange: (c: AdminContent[]) => void;
  showError: (msg: string) => void;
}) {
  const [deletePending, startDelete] = React.useTransition();
  function handleDelete() {
    const snapshot = siblings;
    startDelete(async () => {
      try {
        await deleteContentAction(row.id);
        onSiblingsChange(siblings.filter((c) => c.id !== row.id));
      } catch {
        onSiblingsChange(snapshot);
        showError("콘텐츠 삭제에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }
  return (
    <span style={{ display: "inline-flex", justifyContent: "flex-end", width: "100%" }} onClick={(e) => e.stopPropagation()}>
      <AlertDialogRoot>
        <AlertDialogTrigger asChild>
          <ActionButton variant="criticalSolid" size="xsmall" aria-label="콘텐츠 삭제" disabled={deletePending}>삭제</ActionButton>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>콘텐츠 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${row.title_ko ?? row.id}"을(를) 삭제할까요?\n⚠️ legacy_video_id(${row.legacy_video_id})를 참조하는 user_progress 기록이 고아(orphan)가 됩니다. FK가 없어 자동 정리되지 않습니다.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction variant="neutralOutline" size="medium" style={{ flex: 1 }}>취소</AlertDialogAction>
            <AlertDialogAction variant="criticalSolid" size="medium" style={{ flex: 1 }}
              loading={deletePending} disabled={deletePending} onClick={handleDelete}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogRoot>
    </span>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Add-content drawer

function NativeSelect({
  label, value, options, onChange,
}: {
  label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--seed-color-fg-neutral)" }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--seed-color-stroke-neutral-subtle)",
          backgroundColor: "var(--seed-color-bg-layer-default)", color: "var(--seed-color-fg-neutral)", fontSize: "14px",
        }}>
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </div>
  );
}

function AddContentDrawer({
  episode, contents, onContentsChange, showError,
}: {
  episode: AdminEpisode;
  contents: AdminContent[];
  onContentsChange: (c: AdminContent[]) => void;
  showError: (msg: string) => void;
}) {
  const [newCId, setNewCId] = React.useState("");
  const [newCType, setNewCType] = React.useState<ContentType>("story");
  const [newCTitleKo, setNewCTitleKo] = React.useState("");
  const [newCTitleJp, setNewCTitleJp] = React.useState("");
  const [newCPartLabel, setNewCPartLabel] = React.useState("");
  const [newCLegacyId, setNewCLegacyId] = React.useState("");
  const [addPending, startAdd] = React.useTransition();

  function handleAdd() {
    startAdd(async () => {
      try {
        const row = await createContentAction({
          id: newCId, episode_id: episode.id, type: newCType,
          title_ko: newCTitleKo || null, title_jp: newCTitleJp || null,
          part_label: newCPartLabel || null, legacy_video_id: newCLegacyId, sort_order: 0,
        });
        if (!row) return;
        const serverRow = row as Omit<AdminContent, "content_sources">;
        onContentsChange([...contents, { ...serverRow, content_sources: [] }]);
        setNewCId(""); setNewCType("story"); setNewCTitleKo(""); setNewCTitleJp(""); setNewCPartLabel(""); setNewCLegacyId("");
      } catch {
        showError("콘텐츠 추가에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }

  return (
    <BottomSheetRoot>
      <BottomSheetTrigger asChild>
        <ActionButton variant="brandSolid" size="small">+ 추가</ActionButton>
      </BottomSheetTrigger>
      <BottomSheetContent title="콘텐츠 추가" showHandle>
        <BottomSheetBody>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "8px 0" }}>
            <TextField label="ID (content.id)" aria-label="콘텐츠 ID"><TextFieldInput value={newCId} onChange={(e) => setNewCId(e.target.value)} /></TextField>
            <NativeSelect label="타입" value={newCType} options={CONTENT_TYPES.map((t) => ({ value: t, label: t }))} onChange={(v) => setNewCType(v as ContentType)} />
            <TextField label="제목 (한국어)" aria-label="제목 한국어"><TextFieldInput value={newCTitleKo} onChange={(e) => setNewCTitleKo(e.target.value)} /></TextField>
            <TextField label="제목 (일본어)" aria-label="제목 일본어"><TextFieldInput value={newCTitleJp} onChange={(e) => setNewCTitleJp(e.target.value)} /></TextField>
            <TextField label="파트 레이블" aria-label="파트 레이블"><TextFieldInput value={newCPartLabel} onChange={(e) => setNewCPartLabel(e.target.value)} /></TextField>
            <TextField label="legacy_video_id" aria-label="legacy_video_id"><TextFieldInput value={newCLegacyId} onChange={(e) => setNewCLegacyId(e.target.value)} /></TextField>
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <ActionButton variant="brandSolid" size="medium" style={{ width: "100%" }} loading={addPending} disabled={addPending} onClick={handleAdd}>추가</ActionButton>
        </BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheetRoot>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Toolbar

function Toolbar({
  searchValue, onSearchChange, addButton,
}: {
  searchValue: string; onSearchChange: (v: string) => void; addButton: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 200px", minWidth: "160px", maxWidth: "320px" }}>
        <TextField aria-label="콘텐츠 검색">
          <TextFieldInput type="text" placeholder="콘텐츠 검색…" value={searchValue} onChange={(e) => onSearchChange(e.target.value)} />
        </TextField>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>{addButton}</div>
    </div>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Main

interface ContentsGridProps {
  episode: AdminEpisode;
  onEpisodeChange: (updated: AdminEpisode) => void;
  onDrillIn: (content: AdminContent) => void;
  topBar: React.ReactNode;
}

export function ContentsGrid({ episode, onEpisodeChange, onDrillIn, topBar }: ContentsGridProps) {
  const [search, setSearch] = React.useState("");
  const [reorderPending, startReorder] = React.useTransition();
  const showError = useErrorSnackbar();

  const contents = episode.contents;

  const searchActive = search.trim().length > 0;
  const filteredRows = React.useMemo(
    () =>
      searchActive
        ? contents.filter((c) =>
            (c.title_ko ?? "").toLowerCase().includes(search.toLowerCase()) ||
            (c.title_jp ?? "").toLowerCase().includes(search.toLowerCase()) ||
            c.id.toLowerCase().includes(search.toLowerCase()),
          )
        : contents,
    [contents, search, searchActive],
  );

  const handleContentsChange = React.useCallback(
    (updated: AdminContent[]) => onEpisodeChange({ ...episode, contents: updated }),
    [episode, onEpisodeChange],
  );

  // reorder — 정규 배열(ref) 기준.
  const handleReorder = React.useCallback((contentId: string, dir: "up" | "down") => {
    const all = contents;
    const snapshot = all;
    const idx = all.findIndex((c) => c.id === contentId);
    if (idx < 0) return;
    const to = dir === "up" ? idx - 1 : idx + 1;
    if (to < 0 || to >= all.length) return;
    const ids = all.map((c) => c.id);
    [ids[idx], ids[to]] = [ids[to], ids[idx]];
    const reordered = ids.map((id) => all.find((c) => c.id === id)!);
    handleContentsChange(reordered);
    startReorder(async () => {
      try { await reorderContentsAction(episode.id, ids); }
      catch { handleContentsChange(snapshot); showError("콘텐츠 순서 변경에 실패했어요. 다시 시도해 주세요."); }
    });
  }, [contents, episode.id, handleContentsChange, showError]);

  // 셀 → 표면 커밋. patch 생성/`""→null`/도메인 가드/낙관·롤백을 여기서 소유(원칙 3).
  const handleCommit = React.useCallback((id: string, field: EditableField, value: string) => {
    const patch: Partial<Pick<AdminContent, "type" | "title_ko" | "title_jp" | "part_label" | "category_override">> = {};
    if (field === "type") patch.type = value as ContentType;
    else if (field === "title_ko") patch.title_ko = value || null;
    else if (field === "title_jp") patch.title_jp = value || null;
    else if (field === "part_label") patch.part_label = value || null;
    else if (field === "category_override") patch.category_override = (!value || value === "") ? null : (value as CategoryOverrideValue);
    else return; // 도메인 가드: 그 외 필드는 절대 안 씀(legacy_video_id/id/episode_id/sort_order)

    const snapshot = contents;
    const next = contents.map((c) => (c.id === id ? { ...c, ...patch } : c));
    handleContentsChange(next);
    void (async () => {
      try { await updateContentAction(id, patch); }
      catch { handleContentsChange(snapshot); showError("콘텐츠 저장에 실패했어요. 다시 시도해 주세요."); }
    })();
  }, [contents, handleContentsChange, showError]);

  // columns — deps에 contents 없음(MUST-FIX 4). reorder/commit은 ref/stable handler 사용.
  const columns = React.useMemo<ColumnDef<AdminContent, unknown>[]>(() => [
    {
      id: "sort_order", header: "순서", enableSorting: false,
      meta: { width: 80 } satisfies DataTableColumnMeta,
      cell: ({ row }) => <ReorderCell row={row.original} allRows={contents} onReorder={handleReorder} pending={reorderPending} disabled={searchActive} />,
    },
    {
      accessorKey: "type", header: "타입", enableSorting: false,
      meta: { width: 120, noPadding: true } satisfies DataTableColumnMeta,
      cell: ({ row }) => (
        <EditableSelectCell
          value={row.original.type}
          options={CONTENT_TYPES.map((t) => ({ value: t, label: t }))}
          onCommit={(v) => handleCommit(row.original.id, "type", v)}
          ariaLabel="타입 편집"
          renderDisplay={(v) => <TypeBadge type={v as ContentType} />}
        />
      ),
    },
    {
      accessorKey: "title_ko", header: "제목(ko)", enableSorting: false,
      meta: { noPadding: true } satisfies DataTableColumnMeta, // flex(너비 미지정) — 남는 폭 흡수
      cell: ({ row }) => <EditableTextCell value={row.original.title_ko} onCommit={(v) => handleCommit(row.original.id, "title_ko", v)} ariaLabel="제목(ko) 편집" />,
    },
    {
      accessorKey: "title_jp", header: "제목(jp)", enableSorting: false,
      meta: { width: 140, noPadding: true } satisfies DataTableColumnMeta,
      cell: ({ row }) => <EditableTextCell value={row.original.title_jp} onCommit={(v) => handleCommit(row.original.id, "title_jp", v)} ariaLabel="제목(jp) 편집" />,
    },
    {
      accessorKey: "part_label", header: "파트", enableSorting: false,
      meta: { width: 80, noPadding: true, mono: true } satisfies DataTableColumnMeta,
      cell: ({ row }) => <EditableTextCell value={row.original.part_label} onCommit={(v) => handleCommit(row.original.id, "part_label", v)} ariaLabel="파트 편집" mono />,
    },
    {
      accessorKey: "category_override", header: "카테고리", enableSorting: false,
      meta: { width: 110, noPadding: true } satisfies DataTableColumnMeta,
      cell: ({ row }) => (
        <EditableSelectCell
          value={row.original.category_override}
          options={CATEGORY_OVERRIDE_OPTIONS}
          onCommit={(v) => handleCommit(row.original.id, "category_override", v)}
          ariaLabel="카테고리 편집"
        />
      ),
    },
    {
      id: "content_sources", header: "소스", enableSorting: false,
      meta: { width: 80 } satisfies DataTableColumnMeta,
      cell: ({ row }) => <SourcesCell row={row.original} onDrillIn={onDrillIn} />,
    },
    {
      accessorKey: "legacy_video_id", header: "legacy_video_id", enableSorting: false,
      meta: { width: 160, mono: true, truncate: true } satisfies DataTableColumnMeta,
      cell: ({ row }) => (
        <span style={{ fontFamily: MONO, fontSize: "11px", color: "var(--seed-color-fg-neutral-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
          {row.original.legacy_video_id}
        </span>
      ),
    },
    {
      id: "actions", header: "액션", enableSorting: false,
      meta: { width: 70, align: "right" } satisfies DataTableColumnMeta,
      cell: ({ row }) => <DeleteCell row={row.original} siblings={contents} onSiblingsChange={handleContentsChange} showError={showError} />,
    },
  ], [contents, handleReorder, handleCommit, handleContentsChange, onDrillIn, showError, reorderPending, searchActive]);

  return (
    <DataPageShell
      topBar={topBar}
      counts={`콘텐츠 ${filteredRows.length}개`}
      toolbar={
        <Toolbar
          searchValue={search}
          onSearchChange={setSearch}
          addButton={<AddContentDrawer episode={episode} contents={contents} onContentsChange={handleContentsChange} showError={showError} />}
        />
      }
    >
      <DataTable<AdminContent>
        columns={columns}
        data={filteredRows}
        getRowId={(r) => r.id}
        emptyLabel="콘텐츠가 없습니다."
        enableSorting={false}
      />
    </DataPageShell>
  );
}
