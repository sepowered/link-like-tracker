"use client";

/**
 * ContentsGrid — react-data-grid spreadsheet view for the CONTENTS level (level 2).
 *
 * Replaces the old ContentsTable tbody with a DataGrid while keeping all
 * existing handlers (reorder, update, delete, drill-in, add drawer) intact.
 */

import "react-data-grid/lib/styles.css";

import * as React from "react";
import { DataGrid } from "react-data-grid";
import type { Column, RenderCellProps, RenderEditCellProps } from "react-data-grid";

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

////////////////////////////////////////////////////////////////////////////////////
// Constants — copied from CatalogClient to keep ContentsGrid self-contained

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

////////////////////////////////////////////////////////////////////////////////////
// Cell renderers

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
        fontFamily: MONO,
      }}
    >
      {type}
    </span>
  );
}

// Reorder buttons rendered inside a DataGrid cell
function ReorderCell({
  row,
  allRows,
  onReorder,
  pending,
}: {
  row: AdminContent;
  allRows: AdminContent[];
  onReorder: (contentId: string, dir: "up" | "down") => void;
  pending: boolean;
}) {
  const idx = allRows.findIndex((r) => r.id === row.id);
  const isFirst = idx === 0;
  const isLast = idx === allRows.length - 1;

  return (
    <span
      style={{ display: "inline-flex", gap: "1px", alignItems: "center" }}
      onClick={(e) => e.stopPropagation()}
    >
      <ActionButton
        variant="ghost" size="xsmall" aria-label="위로"
        disabled={isFirst || pending}
        onClick={(e) => { e.stopPropagation(); onReorder(row.id, "up"); }}
        style={{ color: "var(--seed-color-fg-neutral-subtle)" }}
      >↑</ActionButton>
      <ActionButton
        variant="ghost" size="xsmall" aria-label="아래로"
        disabled={isLast || pending}
        onClick={(e) => { e.stopPropagation(); onReorder(row.id, "down"); }}
        style={{ color: "var(--seed-color-fg-neutral-subtle)" }}
      >↓</ActionButton>
    </span>
  );
}

// Inline <select> edit cell for dropdowns
function SelectEditCell<TRow>({
  row,
  column,
  onRowChange,
  onClose,
  options,
}: RenderEditCellProps<TRow> & { options: Array<{ value: string; label: string }> }) {
  const key = column.key as keyof TRow;
  return (
    <select
      autoFocus
      value={String(row[key] ?? "")}
      onChange={(e) => {
        onRowChange({ ...row, [key]: e.target.value }, true);
      }}
      onBlur={() => onClose(true, false)}
      style={{
        width: "100%",
        height: "100%",
        padding: "0 6px",
        border: "none",
        outline: "none",
        backgroundColor: "var(--seed-color-bg-layer-default)",
        color: "var(--seed-color-fg-neutral)",
        fontSize: "12px",
        fontFamily: MONO,
        cursor: "pointer",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// Sources drill-in cell
function SourcesCell({
  row,
  onDrillIn,
}: {
  row: AdminContent;
  onDrillIn: (c: AdminContent) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onDrillIn(row); }}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "2px 8px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: 500,
        backgroundColor: "var(--seed-color-bg-neutral-weak)",
        color: "var(--seed-color-fg-neutral-subtle)",
        whiteSpace: "nowrap",
        fontFamily: MONO,
      }}
    >
      소스 {row.content_sources.length}
    </button>
  );
}

// Delete action cell
function DeleteCell({
  row,
  siblings,
  onSiblingsChange,
  showError,
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
    <span
      style={{ display: "inline-flex", justifyContent: "flex-end", width: "100%" }}
      onClick={(e) => e.stopPropagation()}
    >
      <AlertDialogRoot>
        <AlertDialogTrigger asChild>
          <ActionButton
            variant="criticalSolid" size="xsmall"
            aria-label="콘텐츠 삭제" disabled={deletePending}
          >삭제</ActionButton>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>콘텐츠 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${row.title_ko ?? row.id}"을(를) 삭제할까요?\n⚠️ legacy_video_id(${row.legacy_video_id})를 참조하는 user_progress 기록이 고아(orphan)가 됩니다. FK가 없어 자동 정리되지 않습니다.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction variant="neutralOutline" size="medium" style={{ flex: 1 }}>
              취소
            </AlertDialogAction>
            <AlertDialogAction
              variant="criticalSolid" size="medium"
              style={{ flex: 1 }}
              loading={deletePending} disabled={deletePending}
              onClick={handleDelete}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogRoot>
    </span>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Add-content drawer (toolbar button)

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

function AddContentDrawer({
  episode,
  contents,
  onContentsChange,
  showError,
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
        onContentsChange([...contents, newContent]);
        setNewCId(""); setNewCType("story"); setNewCTitleKo(""); setNewCTitleJp("");
        setNewCPartLabel(""); setNewCLegacyId("");
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
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Toolbar

function Toolbar({
  searchValue, onSearchChange, addButton,
}: {
  searchValue: string;
  onSearchChange: (v: string) => void;
  addButton: React.ReactNode;
}) {
  // flush 툴바: 자체 테두리 없음(DataPageShell toolbar 슬롯이 하단 border 제공).
  // 카운트는 TopBar의 counts 슬롯으로 올라갔다.
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px",
      padding: "8px 12px", flexWrap: "wrap",
    }}>
      <div style={{ flex: "1 1 200px", minWidth: "160px", maxWidth: "320px" }}>
        <TextField aria-label="콘텐츠 검색">
          <TextFieldInput
            type="text" placeholder="콘텐츠 검색…"
            value={searchValue} onChange={(e) => onSearchChange(e.target.value)}
          />
        </TextField>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        {addButton}
      </div>
    </div>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Main ContentsGrid export

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

  const filteredRows = React.useMemo(() =>
    search.trim()
      ? contents.filter((c) =>
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

  function handleReorder(contentId: string, dir: "up" | "down") {
    const snapshot = contents;
    const idx = contents.findIndex((c) => c.id === contentId);
    if (idx < 0) return;
    const to = dir === "up" ? idx - 1 : idx + 1;
    if (to < 0 || to >= contents.length) return;
    const ids = contents.map((c) => c.id);
    [ids[idx], ids[to]] = [ids[to], ids[idx]];
    const reordered = ids.map((id) => contents.find((c) => c.id === id)!);
    handleContentsChange(reordered);
    startReorder(async () => {
      try { await reorderContentsAction(episode.id, ids); }
      catch { handleContentsChange(snapshot); showError("콘텐츠 순서 변경에 실패했어요. 다시 시도해 주세요."); }
    });
  }

  // onRowsChange: cell commit handler for editable columns
  function handleRowsChange(updatedRows: AdminContent[], { indexes, column }: { indexes: number[]; column: { key: string } }) {
    const rowIdx = indexes[0];
    if (rowIdx === undefined) return;
    const updatedRow = updatedRows[rowIdx];
    if (!updatedRow) return;

    const key = column.key as keyof AdminContent;
    // Guard: never write legacy_video_id or non-editable fields
    if (key === "legacy_video_id" || key === "id" || key === "episode_id" || key === "sort_order" || key === "content_sources") return;

    // Build patch — only the changed field
    type EditablePatch = {
      type?: ContentType;
      title_ko?: string | null;
      title_jp?: string | null;
      part_label?: string | null;
      category_override?: CategoryOverrideValue;
    };

    const patch: EditablePatch = {};
    if (key === "type") {
      patch.type = updatedRow.type;
    } else if (key === "title_ko") {
      patch.title_ko = updatedRow.title_ko || null;
    } else if (key === "title_jp") {
      patch.title_jp = updatedRow.title_jp || null;
    } else if (key === "part_label") {
      patch.part_label = updatedRow.part_label || null;
    } else if (key === "category_override") {
      // The grid stores "" as the empty string (from the select option), convert to null.
      // Cast through unknown first because CategoryOverrideValue doesn't include "".
      const raw = updatedRow.category_override as unknown as string | null;
      patch.category_override = (!raw || raw === "") ? null : (raw as CategoryOverrideValue);
    } else {
      return; // unknown key — skip
    }

    // Optimistic: update contents list now; rdg already has the updated rows
    const snapshotContents = contents;
    // Apply the patch to the canonical contents list (which may differ from filteredRows)
    const newContents = contents.map((c) =>
      c.id === updatedRow.id ? { ...c, ...patch } : c,
    );
    handleContentsChange(newContents);

    // Server sync
    void (async () => {
      try {
        await updateContentAction(updatedRow.id, patch);
      } catch {
        handleContentsChange(snapshotContents);
        showError("콘텐츠 저장에 실패했어요. 다시 시도해 주세요.");
      }
    })();
  }

  // 데이터-툴 밀도: 행 ~34px / 헤더 ~36px. 높이 캡 없음 — 그리드가 뷰포트를 채운다.
  const ROW_H = 34;
  const HEADER_H = 36;

  // Column definitions — stable reference (recreate only when handlers change)
  const columns: Column<AdminContent>[] = React.useMemo(
    () => [
      {
        key: "sort_order",
        name: "순서",
        width: 80,
        resizable: false,
        renderCell: ({ row }: RenderCellProps<AdminContent>) => (
          <ReorderCell
            row={row}
            allRows={contents}
            onReorder={handleReorder}
            pending={reorderPending}
          />
        ),
      },
      {
        key: "type",
        name: "타입",
        width: 120,
        resizable: true,
        renderCell: ({ row }: RenderCellProps<AdminContent>) => (
          <TypeBadge type={row.type} />
        ),
        renderEditCell: (props: RenderEditCellProps<AdminContent>) => (
          <SelectEditCell
            {...props}
            options={CONTENT_TYPES.map((t) => ({ value: t, label: t }))}
          />
        ),
      },
      {
        key: "title_ko",
        name: "제목(ko)",
        minWidth: 120,
        resizable: true,
        renderCell: ({ row }: RenderCellProps<AdminContent>) => (
          <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
            {row.title_ko ?? "—"}
          </span>
        ),
        renderEditCell: (props: RenderEditCellProps<AdminContent>) => (
          <TextInlineEditor field="title_ko" {...props} />
        ),
      },
      {
        key: "title_jp",
        name: "제목(jp)",
        minWidth: 100,
        resizable: true,
        renderCell: ({ row }: RenderCellProps<AdminContent>) => (
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", color: "var(--seed-color-fg-neutral-subtle)" }}>
            {row.title_jp ?? "—"}
          </span>
        ),
        renderEditCell: (props: RenderEditCellProps<AdminContent>) => (
          <TextInlineEditor field="title_jp" {...props} />
        ),
      },
      {
        key: "part_label",
        name: "파트",
        width: 80,
        resizable: true,
        renderCell: ({ row }: RenderCellProps<AdminContent>) => (
          <span style={{ color: "var(--seed-color-fg-neutral-subtle)", fontFamily: MONO, fontSize: "11px" }}>
            {row.part_label ?? "—"}
          </span>
        ),
        renderEditCell: (props: RenderEditCellProps<AdminContent>) => (
          <TextInlineEditor field="part_label" {...props} />
        ),
      },
      {
        key: "category_override",
        name: "카테고리",
        width: 110,
        resizable: true,
        renderCell: ({ row }: RenderCellProps<AdminContent>) => (
          <span style={{ color: "var(--seed-color-fg-neutral-subtle)", fontFamily: MONO, fontSize: "11px" }}>
            {row.category_override ?? "auto"}
          </span>
        ),
        renderEditCell: (props: RenderEditCellProps<AdminContent>) => (
          <SelectEditCell
            {...props}
            options={CATEGORY_OVERRIDE_OPTIONS}
          />
        ),
      },
      {
        key: "content_sources",
        name: "소스",
        width: 80,
        resizable: false,
        renderCell: ({ row }: RenderCellProps<AdminContent>) => (
          <SourcesCell row={row} onDrillIn={onDrillIn} />
        ),
      },
      {
        key: "legacy_video_id",
        name: "legacy_video_id",
        width: 160,
        resizable: true,
        renderCell: ({ row }: RenderCellProps<AdminContent>) => (
          <span style={{ fontFamily: MONO, fontSize: "11px", color: "var(--seed-color-fg-neutral-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
            {row.legacy_video_id}
          </span>
        ),
      },
      {
        key: "actions",
        name: "액션",
        width: 70,
        resizable: false,
        renderCell: ({ row }: RenderCellProps<AdminContent>) => (
          <DeleteCell
            row={row}
            siblings={contents}
            onSiblingsChange={handleContentsChange}
            showError={showError}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contents, reorderPending, onDrillIn, showError],
  );

  return (
    <DataPageShell
      topBar={topBar}
      counts={`콘텐츠 ${filteredRows.length}개`}
      toolbar={
        <Toolbar
          searchValue={search}
          onSearchChange={setSearch}
          addButton={
            <AddContentDrawer
              episode={episode}
              contents={contents}
              onContentsChange={handleContentsChange}
              showError={showError}
            />
          }
        />
      }
    >
      {/* Grid wrapper: rdg가 뷰포트를 풀-블리드로 채운다(높이 캡/라운드 없음).
          CSS custom properties map rdg vars to seed tokens. */}
      <div
        style={{
          // rdg theming via CSS custom properties
          "--rdg-color": "var(--seed-color-fg-neutral)",
          "--rdg-border-color": "var(--seed-color-stroke-neutral-subtle)",
          "--rdg-summary-border-color": "var(--seed-color-stroke-neutral-subtle)",
          "--rdg-background-color": "var(--seed-color-bg-layer-default)",
          "--rdg-header-background-color": "var(--seed-color-bg-neutral-weak)",
          "--rdg-header-draggable-background-color": "var(--seed-color-bg-neutral-weak-pressed)",
          "--rdg-row-hover-background-color": "var(--seed-color-bg-neutral-weak)",
          "--rdg-row-selected-background-color": "var(--seed-color-bg-brand-weak)",
          "--rdg-row-selected-hover-background-color": "var(--seed-color-bg-brand-weak)",
          "--rdg-checkbox-color": "var(--seed-color-fg-brand)",
          "--rdg-checkbox-focus-color": "var(--seed-color-fg-brand)",
          "--rdg-checkbox-disabled-border-color": "var(--seed-color-stroke-neutral-subtle)",
          "--rdg-checkbox-disabled-background-color": "var(--seed-color-bg-neutral-weak)",
          "--rdg-selection-color": "var(--seed-color-stroke-brand)",
          "--rdg-font-size": "13px",
          // 뷰포트(DataPageShell Row 3)가 바운디드 높이를 주므로 100%로 꽉 채운다.
          height: "100%",
        } as React.CSSProperties}
      >
        <DataGrid<AdminContent>
          columns={columns}
          rows={filteredRows}
          rowKeyGetter={(row) => row.id}
          onRowsChange={handleRowsChange}
          rowHeight={ROW_H}
          headerRowHeight={HEADER_H}
          style={{ blockSize: "100%" }}
          defaultColumnOptions={{ resizable: true }}
        />
      </div>
    </DataPageShell>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Inline text editor — a plain <input> that reads/writes a string field of AdminContent

function TextInlineEditor({
  row,
  column,
  onRowChange,
  onClose,
  field,
}: RenderEditCellProps<AdminContent> & { field: keyof AdminContent }) {
  const rawVal = row[field];
  const strVal = rawVal === null || rawVal === undefined ? "" : String(rawVal);

  return (
    <input
      autoFocus
      value={strVal}
      onChange={(e) => {
        onRowChange({ ...row, [field]: e.target.value });
      }}
      onBlur={() => onClose(true, false)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { onClose(true, false); }
        if (e.key === "Escape") { onClose(false, true); }
      }}
      style={{
        width: "100%",
        height: "100%",
        padding: "0 8px",
        border: "none",
        outline: "none",
        backgroundColor: "var(--seed-color-bg-layer-default)",
        color: "var(--seed-color-fg-neutral)",
        fontSize: "13px",
        boxSizing: "border-box",
      }}
    />
  );
}
