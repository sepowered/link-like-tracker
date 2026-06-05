"use client";

/**
 * CatalogClient — 카탈로그 관리 인터랙티브 UI.
 *
 * 트리 구조: 시즌 → 에피소드 → 콘텐츠 → 소스
 * - AccordionRoot/Item/Trigger/Content 로 시즌·에피소드 접기/펼치기
 * - 콘텐츠·소스 행은 직접 렌더 (seed Table primitive 사용 금지)
 * - BottomSheetRoot 로 편집·생성 드로어
 * - AlertDialogRoot 로 삭제 확인 (콘텐츠 삭제 시 user_progress 고아 경고 포함)
 * - 순서 변경: 위/아래 ActionButton → reorder 액션 호출 (낙관적 업데이트 + 오류 시 롤백)
 * - 모든 mutation: try/catch → 실패 시 스냅샷으로 롤백 + Snackbar 오류 표시
 *
 * 타입: @/lib/admin/catalog-types (빌드 경계 분리)
 * URL 렌더: safeHttpHref(@/lib/safe-url) — javascript: 등 위험 스킴 차단
 */

import * as React from "react";
import {
  AccordionRoot,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/ui/accordion";
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

////////////////////////////////////////////////////////////////////////////////////
// Helpers

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

function TypeBadge({ type }: { type: ContentType }) {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.special;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 6px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 600,
        backgroundColor: c.bg,
        color: c.fg,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {type}
    </span>
  );
}

function ReorderButtons({
  onUp,
  onDown,
  isFirst,
  isLast,
  pending,
}: {
  onUp: () => void;
  onDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  pending: boolean;
}) {
  return (
    <span style={{ display: "inline-flex", gap: "2px", flexShrink: 0 }}>
      <ActionButton
        variant="ghost"
        size="xsmall"
        aria-label="위로"
        disabled={isFirst || pending}
        onClick={onUp}
      >
        ↑
      </ActionButton>
      <ActionButton
        variant="ghost"
        size="xsmall"
        aria-label="아래로"
        disabled={isLast || pending}
        onClick={onDown}
      >
        ↓
      </ActionButton>
    </span>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Shared styles

const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "6px 0",
  fontSize: "13px",
  color: "var(--seed-color-fg-neutral)",
};

const LABEL_STYLE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const SUBTLE: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--seed-color-fg-neutral-subtle)",
};

////////////////////////////////////////////////////////////////////////////////////
// NativeSelect — no seed Table/Select primitive

function NativeSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label
        style={{ fontSize: "13px", fontWeight: 600, color: "var(--seed-color-fg-neutral)" }}
      >
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
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// SimpleDrawer — generic field list + save button

interface DrawerField {
  name: string;
  label: string;
  value: string;
  readOnly?: boolean;
  inputType?: "text" | "number";
}

function SimpleDrawer({
  title,
  fields,
  onChange,
  onSubmit,
  pending,
  trigger,
  submitLabel = "저장",
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
            variant="brandSolid"
            size="medium"
            style={{ width: "100%" }}
            loading={pending}
            disabled={pending}
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
// DeleteConfirm — AlertDialog wrapper

function DeleteConfirm({
  trigger,
  title,
  description,
  onConfirm,
  pending,
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
            variant="criticalSolid"
            size="medium"
            style={{ flex: 1 }}
            loading={pending}
            disabled={pending}
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
// useErrorSnackbar — 오류 시 Snackbar를 띄우는 헬퍼

function useErrorSnackbar() {
  const adapter = useSnackbarAdapter();
  return React.useCallback(
    (msg: string) => {
      adapter.create({
        render: () => (
          <Snackbar variant="critical" message={msg} />
        ),
      });
    },
    [adapter],
  );
}

////////////////////////////////////////////////////////////////////////////////////
// SourceRow

function SourceRow({
  source,
  contentId,
  index,
  siblings,
  onSiblingsChange,
}: {
  source: AdminContentSource;
  contentId: string;
  index: number;
  siblings: AdminContentSource[];
  onSiblingsChange: (updated: AdminContentSource[]) => void;
}) {
  const total = siblings.length;
  const [editUrl, setEditUrl] = React.useState(source.url);
  const [editLabel, setEditLabel] = React.useState(source.label ?? "");
  const [editTimestamp, setEditTimestamp] = React.useState(
    source.timestamp_todo ? "true" : "false",
  );
  const [editPending, startEditTransition] = React.useTransition();
  const [deletePending, startDeleteTransition] = React.useTransition();
  const [reorderPending, startReorderTransition] = React.useTransition();
  const showError = useErrorSnackbar();

  function handleReorder(direction: "up" | "down") {
    const snapshot = siblings;
    const ids = siblings.map((s) => s.id);
    const to = direction === "up" ? index - 1 : index + 1;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    const reordered = ids.map((id) => siblings.find((s) => s.id === id)!);
    onSiblingsChange(reordered);
    startReorderTransition(async () => {
      try {
        await reorderContentSourcesAction(contentId, ids);
      } catch {
        onSiblingsChange(snapshot);
        showError("소스 순서 변경에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }

  function handleSave() {
    const snapshot = siblings;
    startEditTransition(async () => {
      try {
        await updateContentSourceAction(source.id, {
          url: editUrl,
          label: editLabel || null,
          timestamp_todo: editTimestamp === "true",
        });
        onSiblingsChange(
          siblings.map((s) =>
            s.id === source.id
              ? { ...s, url: editUrl, label: editLabel || null, timestamp_todo: editTimestamp === "true" }
              : s,
          ),
        );
      } catch {
        onSiblingsChange(snapshot);
        showError("소스 저장에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }

  function handleDelete() {
    const snapshot = siblings;
    startDeleteTransition(async () => {
      try {
        await deleteContentSourceAction(source.id);
        onSiblingsChange(siblings.filter((s) => s.id !== source.id));
      } catch {
        onSiblingsChange(snapshot);
        showError("소스 삭제에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }

  // safeHttpHref: javascript: 등 위험 스킴 차단
  const safeHref = safeHttpHref(source.url);

  return (
    <div
      style={{
        ...ROW_STYLE,
        paddingLeft: "8px",
        borderLeft: "2px solid var(--seed-color-stroke-neutral-subtle)",
        marginLeft: "4px",
      }}
    >
      <ReorderButtons
        onUp={() => handleReorder("up")}
        onDown={() => handleReorder("down")}
        isFirst={index === 0}
        isLast={index === total - 1}
        pending={reorderPending}
      />
      <span style={{ ...LABEL_STYLE, fontSize: "12px" }}>
        <span style={SUBTLE}>{source.label || "소스"}</span>{" "}
        {safeHref ? (
          <a
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--seed-color-fg-brand)", fontSize: "11px" }}
          >
            {source.url.length > 40 ? source.url.slice(0, 40) + "…" : source.url}
          </a>
        ) : (
          <span style={{ color: "var(--seed-color-fg-neutral-subtle)", fontSize: "11px" }}>
            {source.url.length > 40 ? source.url.slice(0, 40) + "…" : source.url}
          </span>
        )}
        {source.timestamp_todo && (
          <span style={{ marginLeft: "4px", fontSize: "10px", color: "var(--seed-color-fg-warning)" }}>
            timestamp 미정
          </span>
        )}
      </span>

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
          <ActionButton variant="neutralOutline" size="xsmall" aria-label="소스 편집">
            편집
          </ActionButton>
        }
      />

      <DeleteConfirm
        trigger={
          <ActionButton variant="criticalSolid" size="xsmall" aria-label="소스 삭제" disabled={deletePending}>
            삭제
          </ActionButton>
        }
        title="소스 삭제"
        description="이 소스를 삭제할까요?"
        onConfirm={handleDelete}
        pending={deletePending}
      />
    </div>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// ContentRow

function ContentRow({
  content,
  episodeId,
  index,
  siblings,
  onSiblingsChange,
}: {
  content: AdminContent;
  episodeId: string;
  index: number;
  siblings: AdminContent[];
  onSiblingsChange: (updated: AdminContent[]) => void;
}) {
  const total = siblings.length;
  const [showSources, setShowSources] = React.useState(false);

  const [editType, setEditType] = React.useState<ContentType>(content.type);
  const [editCatOverride, setEditCatOverride] = React.useState<string>(
    content.category_override ?? "",
  );
  const [editTitleKo, setEditTitleKo] = React.useState(content.title_ko ?? "");
  const [editTitleJp, setEditTitleJp] = React.useState(content.title_jp ?? "");
  const [editPartLabel, setEditPartLabel] = React.useState(content.part_label ?? "");

  const [newSrcUrl, setNewSrcUrl] = React.useState("");
  const [newSrcLabel, setNewSrcLabel] = React.useState("");
  const [newSrcTimestamp, setNewSrcTimestamp] = React.useState("false");

  const [editPending, startEditTransition] = React.useTransition();
  const [deletePending, startDeleteTransition] = React.useTransition();
  const [reorderPending, startReorderTransition] = React.useTransition();
  const [addSrcPending, startAddSrcTransition] = React.useTransition();
  const showError = useErrorSnackbar();

  function handleReorder(direction: "up" | "down") {
    const snapshot = siblings;
    const ids = siblings.map((c) => c.id);
    const to = direction === "up" ? index - 1 : index + 1;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    const reordered = ids.map((id) => siblings.find((c) => c.id === id)!);
    onSiblingsChange(reordered);
    startReorderTransition(async () => {
      try {
        await reorderContentsAction(episodeId, ids);
      } catch {
        onSiblingsChange(snapshot);
        showError("콘텐츠 순서 변경에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }

  function handleSave() {
    const category_override: CategoryOverrideValue =
      editCatOverride === "" ? null : (editCatOverride as CategoryOverrideValue);
    const snapshot = siblings;
    startEditTransition(async () => {
      try {
        await updateContentAction(content.id, {
          type: editType,
          title_ko: editTitleKo || null,
          title_jp: editTitleJp || null,
          part_label: editPartLabel || null,
          category_override,
        });
        onSiblingsChange(
          siblings.map((c) =>
            c.id === content.id
              ? {
                  ...c,
                  type: editType,
                  title_ko: editTitleKo || null,
                  title_jp: editTitleJp || null,
                  part_label: editPartLabel || null,
                  category_override,
                }
              : c,
          ),
        );
      } catch {
        onSiblingsChange(snapshot);
        showError("콘텐츠 저장에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }

  function handleDelete() {
    const snapshot = siblings;
    startDeleteTransition(async () => {
      try {
        await deleteContentAction(content.id);
        onSiblingsChange(siblings.filter((c) => c.id !== content.id));
      } catch {
        onSiblingsChange(snapshot);
        showError("콘텐츠 삭제에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }

  function handleAddSource() {
    startAddSrcTransition(async () => {
      try {
        // sort_order는 서버에서 계산 — 클라이언트 length 기반 값을 신뢰하지 않는다
        const row = await createContentSourceAction({
          content_id: content.id,
          url: newSrcUrl,
          label: newSrcLabel || null,
          timestamp_todo: newSrcTimestamp === "true",
          sort_order: 0, // 서버가 max+1로 덮어씀; 여기선 placeholder
        });
        if (!row) return;
        // 서버 반환 row의 id와 sort_order를 그대로 사용
        const newSrc = row as AdminContentSource;
        onSiblingsChange(
          siblings.map((c) =>
            c.id === content.id
              ? { ...c, content_sources: [...c.content_sources, newSrc] }
              : c,
          ),
        );
        setNewSrcUrl("");
        setNewSrcLabel("");
        setNewSrcTimestamp("false");
      } catch {
        showError("소스 추가에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }

  function handleSourcesChange(updated: AdminContentSource[]) {
    onSiblingsChange(
      siblings.map((c) =>
        c.id === content.id ? { ...c, content_sources: updated } : c,
      ),
    );
  }

  return (
    <div style={{ borderBottom: "1px solid var(--seed-color-stroke-neutral-subtle)" }}>
      <div style={ROW_STYLE}>
        <ReorderButtons
          onUp={() => handleReorder("up")}
          onDown={() => handleReorder("down")}
          isFirst={index === 0}
          isLast={index === total - 1}
          pending={reorderPending}
        />

        <TypeBadge type={content.type} />

        <span style={LABEL_STYLE} title={content.id}>
          <span style={{ fontWeight: 500 }}>
            {content.title_ko ?? content.title_jp ?? content.id}
          </span>
          {content.part_label && (
            <span style={{ ...SUBTLE, marginLeft: "4px" }}>({content.part_label})</span>
          )}
          <span style={{ ...SUBTLE, marginLeft: "6px" }}>{content.id}</span>
        </span>

        <ActionButton
          variant="neutralWeak"
          size="xsmall"
          onClick={() => setShowSources((v) => !v)}
          aria-label={showSources ? "소스 숨기기" : "소스 보기"}
        >
          소스 {content.content_sources.length}
        </ActionButton>

        {/* 콘텐츠 편집 드로어 */}
        <BottomSheetRoot>
          <BottomSheetTrigger asChild>
            <ActionButton variant="neutralOutline" size="xsmall" aria-label="콘텐츠 편집">
              편집
            </ActionButton>
          </BottomSheetTrigger>
          <BottomSheetContent title="콘텐츠 편집" showHandle>
            <BottomSheetBody>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "8px 0" }}>
                {/* legacy_video_id — READ-ONLY */}
                <TextField label="legacy_video_id (읽기 전용)" readOnly aria-label="legacy_video_id">
                  <TextFieldInput value={content.legacy_video_id} readOnly />
                </TextField>

                <NativeSelect
                  label="타입"
                  value={editType}
                  options={CONTENT_TYPES.map((t) => ({ value: t, label: t }))}
                  onChange={(v) => setEditType(v as ContentType)}
                />

                <TextField label="제목 (한국어)" aria-label="제목 한국어">
                  <TextFieldInput
                    value={editTitleKo}
                    onChange={(e) => setEditTitleKo(e.target.value)}
                  />
                </TextField>

                <TextField label="제목 (일본어)" aria-label="제목 일본어">
                  <TextFieldInput
                    value={editTitleJp}
                    onChange={(e) => setEditTitleJp(e.target.value)}
                  />
                </TextField>

                <TextField label="파트 레이블" aria-label="파트 레이블">
                  <TextFieldInput
                    value={editPartLabel}
                    onChange={(e) => setEditPartLabel(e.target.value)}
                  />
                </TextField>

                <NativeSelect
                  label="카테고리 오버라이드"
                  value={editCatOverride}
                  options={CATEGORY_OVERRIDE_OPTIONS}
                  onChange={setEditCatOverride}
                />
              </div>
            </BottomSheetBody>
            <BottomSheetFooter>
              <ActionButton
                variant="brandSolid"
                size="medium"
                style={{ width: "100%" }}
                loading={editPending}
                disabled={editPending}
                onClick={handleSave}
              >
                저장
              </ActionButton>
            </BottomSheetFooter>
          </BottomSheetContent>
        </BottomSheetRoot>

        {/* 콘텐츠 삭제 — user_progress 고아 경고 */}
        <DeleteConfirm
          trigger={
            <ActionButton variant="criticalSolid" size="xsmall" aria-label="콘텐츠 삭제" disabled={deletePending}>
              삭제
            </ActionButton>
          }
          title="콘텐츠 삭제"
          description={`"${content.title_ko ?? content.id}" 을(를) 삭제할까요?\n⚠️ legacy_video_id(${content.legacy_video_id})를 참조하는 user_progress 기록이 고아(orphan)가 됩니다. FK가 없어 자동 정리되지 않습니다.`}
          onConfirm={handleDelete}
          pending={deletePending}
        />
      </div>

      {/* 소스 목록 */}
      {showSources && (
        <div style={{ paddingLeft: "32px", paddingBottom: "8px" }}>
          {content.content_sources.length === 0 ? (
            <p style={{ ...SUBTLE, margin: "4px 0 8px" }}>소스 없음</p>
          ) : (
            content.content_sources.map((src, si) => (
              <SourceRow
                key={src.id}
                source={src}
                contentId={content.id}
                index={si}
                siblings={content.content_sources}
                onSiblingsChange={handleSourcesChange}
              />
            ))
          )}

          {/* 소스 추가 드로어 */}
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
            onSubmit={handleAddSource}
            pending={addSrcPending}
            trigger={
              <ActionButton variant="neutralWeak" size="xsmall" style={{ marginTop: "4px" }}>
                + 소스 추가
              </ActionButton>
            }
            submitLabel="추가"
          />
        </div>
      )}
    </div>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// EpisodeSection

function EpisodeSection({
  episode,
  seasonId,
  index,
  siblings,
  onSiblingsChange,
}: {
  episode: AdminEpisode;
  seasonId: string;
  index: number;
  siblings: AdminEpisode[];
  onSiblingsChange: (updated: AdminEpisode[]) => void;
}) {
  const total = siblings.length;
  const [editEpNum, setEditEpNum] = React.useState(String(episode.episode_number));
  const [editTitleKo, setEditTitleKo] = React.useState(episode.title_ko ?? "");
  const [editTitleJp, setEditTitleJp] = React.useState(episode.title_jp ?? "");

  const [newCId, setNewCId] = React.useState("");
  const [newCType, setNewCType] = React.useState<ContentType>("story");
  const [newCTitleKo, setNewCTitleKo] = React.useState("");
  const [newCTitleJp, setNewCTitleJp] = React.useState("");
  const [newCPartLabel, setNewCPartLabel] = React.useState("");
  const [newCLegacyId, setNewCLegacyId] = React.useState("");

  const [editPending, startEditTransition] = React.useTransition();
  const [deletePending, startDeleteTransition] = React.useTransition();
  const [reorderPending, startReorderTransition] = React.useTransition();
  const [addContentPending, startAddContentTransition] = React.useTransition();
  const showError = useErrorSnackbar();

  function handleReorder(direction: "up" | "down") {
    const snapshot = siblings;
    const ids = siblings.map((e) => e.id);
    const to = direction === "up" ? index - 1 : index + 1;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    const reordered = ids.map((id) => siblings.find((e) => e.id === id)!);
    onSiblingsChange(reordered);
    startReorderTransition(async () => {
      try {
        await reorderEpisodesAction(seasonId, ids);
      } catch {
        onSiblingsChange(snapshot);
        showError("에피소드 순서 변경에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }

  function handleSave() {
    const snapshot = siblings;
    startEditTransition(async () => {
      try {
        await updateEpisodeAction(episode.id, {
          episode_number: Number(editEpNum),
          title_ko: editTitleKo || null,
          title_jp: editTitleJp || null,
        });
        onSiblingsChange(
          siblings.map((e) =>
            e.id === episode.id
              ? {
                  ...e,
                  episode_number: Number(editEpNum),
                  title_ko: editTitleKo || null,
                  title_jp: editTitleJp || null,
                }
              : e,
          ),
        );
      } catch {
        onSiblingsChange(snapshot);
        showError("에피소드 저장에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }

  function handleDelete() {
    const snapshot = siblings;
    startDeleteTransition(async () => {
      try {
        await deleteEpisodeAction(episode.id);
        onSiblingsChange(siblings.filter((e) => e.id !== episode.id));
      } catch {
        onSiblingsChange(snapshot);
        showError("에피소드 삭제에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }

  function handleAddContent() {
    startAddContentTransition(async () => {
      try {
        // sort_order는 서버에서 max+1로 계산 — 클라이언트 length 미사용
        const row = await createContentAction({
          id: newCId,
          episode_id: episode.id,
          type: newCType,
          title_ko: newCTitleKo || null,
          title_jp: newCTitleJp || null,
          part_label: newCPartLabel || null,
          legacy_video_id: newCLegacyId,
          sort_order: 0, // 서버가 max+1로 덮어씀; placeholder
        });
        if (!row) return;
        // 서버 반환 row 기반으로 로컬 상태 구성
        const serverRow = row as Omit<AdminContent, "content_sources">;
        const newContent: AdminContent = { ...serverRow, content_sources: [] };
        onSiblingsChange(
          siblings.map((e) =>
            e.id === episode.id ? { ...e, contents: [...e.contents, newContent] } : e,
          ),
        );
        setNewCId("");
        setNewCType("story");
        setNewCTitleKo("");
        setNewCTitleJp("");
        setNewCPartLabel("");
        setNewCLegacyId("");
      } catch {
        showError("콘텐츠 추가에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }

  function handleContentsChange(updated: AdminContent[]) {
    onSiblingsChange(
      siblings.map((e) => (e.id === episode.id ? { ...e, contents: updated } : e)),
    );
  }

  return (
    <div style={{ borderBottom: "1px solid var(--seed-color-stroke-neutral-subtle)", padding: "8px 0" }}>
      {/* 에피소드 헤더 행 */}
      <div style={ROW_STYLE}>
        <ReorderButtons
          onUp={() => handleReorder("up")}
          onDown={() => handleReorder("down")}
          isFirst={index === 0}
          isLast={index === total - 1}
          pending={reorderPending}
        />
        <span style={{ ...LABEL_STYLE, fontWeight: 600 }}>
          {episode.episode_number}화
          {episode.title_ko ? ` · ${episode.title_ko}` : ""}
          <span style={{ ...SUBTLE, marginLeft: "6px", fontWeight: 400 }}>{episode.id}</span>
        </span>

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
            <ActionButton variant="neutralOutline" size="xsmall" aria-label="에피소드 편집">
              편집
            </ActionButton>
          }
        />

        <DeleteConfirm
          trigger={
            <ActionButton variant="criticalSolid" size="xsmall" aria-label="에피소드 삭제" disabled={deletePending}>
              삭제
            </ActionButton>
          }
          title="에피소드 삭제"
          description={`에피소드 "${episode.title_ko ?? episode.id}"과 하위 콘텐츠·소스를 모두 삭제할까요? (cascade)`}
          onConfirm={handleDelete}
          pending={deletePending}
        />
      </div>

      {/* 콘텐츠 목록 */}
      <div style={{ paddingLeft: "32px" }}>
        {episode.contents.length === 0 ? (
          <p style={{ ...SUBTLE, margin: "4px 0" }}>콘텐츠 없음</p>
        ) : (
          episode.contents.map((c, ci) => (
            <ContentRow
              key={c.id}
              content={c}
              episodeId={episode.id}
              index={ci}
              siblings={episode.contents}
              onSiblingsChange={handleContentsChange}
            />
          ))
        )}

        {/* 콘텐츠 추가 드로어 */}
        <BottomSheetRoot>
          <BottomSheetTrigger asChild>
            <ActionButton variant="neutralWeak" size="xsmall" style={{ marginTop: "8px" }}>
              + 콘텐츠 추가
            </ActionButton>
          </BottomSheetTrigger>
          <BottomSheetContent title="콘텐츠 추가" showHandle>
            <BottomSheetBody>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "8px 0" }}>
                <TextField label="ID (content.id)" aria-label="콘텐츠 ID">
                  <TextFieldInput value={newCId} onChange={(e) => setNewCId(e.target.value)} />
                </TextField>
                <NativeSelect
                  label="타입"
                  value={newCType}
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
                variant="brandSolid"
                size="medium"
                style={{ width: "100%" }}
                loading={addContentPending}
                disabled={addContentPending}
                onClick={handleAddContent}
              >
                추가
              </ActionButton>
            </BottomSheetFooter>
          </BottomSheetContent>
        </BottomSheetRoot>
      </div>
    </div>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// SeasonItem

function SeasonItem({
  season,
  index,
  siblings,
  onSiblingsChange,
}: {
  season: AdminSeason;
  index: number;
  siblings: AdminSeason[];
  onSiblingsChange: (updated: AdminSeason[]) => void;
}) {
  const total = siblings.length;
  const [editName, setEditName] = React.useState(season.name);

  const [newEpId, setNewEpId] = React.useState("");
  const [newEpNum, setNewEpNum] = React.useState("");
  const [newEpTitleKo, setNewEpTitleKo] = React.useState("");
  const [newEpTitleJp, setNewEpTitleJp] = React.useState("");

  const [editPending, startEditTransition] = React.useTransition();
  const [deletePending, startDeleteTransition] = React.useTransition();
  const [reorderPending, startReorderTransition] = React.useTransition();
  const [addEpPending, startAddEpTransition] = React.useTransition();
  const showError = useErrorSnackbar();

  function handleReorder(direction: "up" | "down") {
    const snapshot = siblings;
    const ids = siblings.map((s) => s.id);
    const to = direction === "up" ? index - 1 : index + 1;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    const reordered = ids.map((id) => siblings.find((s) => s.id === id)!);
    onSiblingsChange(reordered);
    startReorderTransition(async () => {
      try {
        await reorderSeasonsAction(ids);
      } catch {
        onSiblingsChange(snapshot);
        showError("시즌 순서 변경에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }

  function handleSave() {
    const snapshot = siblings;
    startEditTransition(async () => {
      try {
        await updateSeasonAction(season.id, { name: editName });
        onSiblingsChange(
          siblings.map((s) => (s.id === season.id ? { ...s, name: editName } : s)),
        );
      } catch {
        onSiblingsChange(snapshot);
        showError("시즌 저장에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }

  function handleDelete() {
    const snapshot = siblings;
    startDeleteTransition(async () => {
      try {
        await deleteSeasonAction(season.id);
        onSiblingsChange(siblings.filter((s) => s.id !== season.id));
      } catch {
        onSiblingsChange(snapshot);
        showError("시즌 삭제에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }

  function handleAddEpisode() {
    startAddEpTransition(async () => {
      try {
        // sort_order는 서버에서 max+1로 계산 — 클라이언트 length 미사용
        const row = await createEpisodeAction({
          id: newEpId,
          season_id: season.id,
          episode_number: Number(newEpNum),
          title_ko: newEpTitleKo || null,
          title_jp: newEpTitleJp || null,
          sort_order: 0, // 서버가 max+1로 덮어씀; placeholder
        });
        if (!row) return;
        // 서버 반환 row 기반으로 로컬 상태 구성
        const serverRow = row as Omit<AdminEpisode, "contents">;
        const newEp: AdminEpisode = { ...serverRow, contents: [] };
        onSiblingsChange(
          siblings.map((s) =>
            s.id === season.id ? { ...s, episodes: [...s.episodes, newEp] } : s,
          ),
        );
        setNewEpId("");
        setNewEpNum("");
        setNewEpTitleKo("");
        setNewEpTitleJp("");
      } catch {
        showError("에피소드 추가에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }

  function handleEpisodesChange(updated: AdminEpisode[]) {
    onSiblingsChange(
      siblings.map((s) => (s.id === season.id ? { ...s, episodes: updated } : s)),
    );
  }

  return (
    <AccordionItem value={season.id}>
      {/* 시즌 헤더 행 — 재정렬 버튼 + AccordionTrigger + 편집/삭제 */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <ReorderButtons
          onUp={() => handleReorder("up")}
          onDown={() => handleReorder("down")}
          isFirst={index === 0}
          isLast={index === total - 1}
          pending={reorderPending}
        />

        <AccordionTrigger
          title={season.name}
          description={`에피소드 ${season.episodes.length}개 · ID: ${season.id}`}
          headingLevel={3}
          style={{ flex: 1 }}
        />

        <SimpleDrawer
          title="시즌 편집"
          fields={[{ name: "name", label: "이름", value: editName }]}
          onChange={(_name, value) => setEditName(value)}
          onSubmit={handleSave}
          pending={editPending}
          trigger={
            <ActionButton variant="neutralOutline" size="xsmall" aria-label="시즌 편집" style={{ flexShrink: 0 }}>
              편집
            </ActionButton>
          }
        />

        <DeleteConfirm
          trigger={
            <ActionButton variant="criticalSolid" size="xsmall" aria-label="시즌 삭제" disabled={deletePending} style={{ flexShrink: 0 }}>
              삭제
            </ActionButton>
          }
          title="시즌 삭제"
          description={`시즌 "${season.name}"과 하위 에피소드·콘텐츠·소스를 모두 삭제할까요? (cascade)`}
          onConfirm={handleDelete}
          pending={deletePending}
        />
      </div>

      {/* 시즌 펼침 내용 */}
      <AccordionContent>
        <div style={{ paddingLeft: "8px", paddingBottom: "8px" }}>
          {season.episodes.length === 0 ? (
            <p style={{ ...SUBTLE, margin: "8px 0" }}>에피소드 없음</p>
          ) : (
            season.episodes.map((ep, ei) => (
              <EpisodeSection
                key={ep.id}
                episode={ep}
                seasonId={season.id}
                index={ei}
                siblings={season.episodes}
                onSiblingsChange={handleEpisodesChange}
              />
            ))
          )}

          {/* 에피소드 추가 드로어 */}
          <BottomSheetRoot>
            <BottomSheetTrigger asChild>
              <ActionButton variant="neutralWeak" size="xsmall" style={{ marginTop: "12px" }}>
                + 에피소드 추가
              </ActionButton>
            </BottomSheetTrigger>
            <BottomSheetContent title="에피소드 추가" showHandle>
              <BottomSheetBody>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "8px 0" }}>
                  <TextField label="ID (episode.id)" aria-label="에피소드 ID">
                    <TextFieldInput value={newEpId} onChange={(e) => setNewEpId(e.target.value)} />
                  </TextField>
                  <TextField label="화수" aria-label="화수">
                    <TextFieldInput
                      type="number"
                      value={newEpNum}
                      onChange={(e) => setNewEpNum(e.target.value)}
                    />
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
                  variant="brandSolid"
                  size="medium"
                  style={{ width: "100%" }}
                  loading={addEpPending}
                  disabled={addEpPending}
                  onClick={handleAddEpisode}
                >
                  추가
                </ActionButton>
              </BottomSheetFooter>
            </BottomSheetContent>
          </BottomSheetRoot>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

////////////////////////////////////////////////////////////////////////////////////
// Main CatalogClient

interface CatalogClientProps {
  initialSeasons: AdminSeason[];
}

function CatalogClientInner({ initialSeasons }: CatalogClientProps) {
  const [seasons, setSeasons] = React.useState<AdminSeason[]>(initialSeasons);

  const [newSId, setNewSId] = React.useState("");
  const [newSName, setNewSName] = React.useState("");
  const [addSeasonPending, startAddSeasonTransition] = React.useTransition();
  const showError = useErrorSnackbar();

  function handleAddSeason() {
    startAddSeasonTransition(async () => {
      try {
        // sort_order는 서버에서 max+1로 계산
        const row = await createSeasonAction({
          id: newSId,
          name: newSName,
          sort_order: 0, // 서버가 max+1로 덮어씀; placeholder
        });
        if (!row) return;
        const serverRow = row as Omit<AdminSeason, "episodes">;
        const newSeason: AdminSeason = { ...serverRow, episodes: [] };
        setSeasons((prev) => [...prev, newSeason]);
        setNewSId("");
        setNewSName("");
      } catch {
        showError("시즌 추가에 실패했어요. 다시 시도해 주세요.");
      }
    });
  }

  return (
    <div>
      <AccordionRoot>
        {seasons.map((season, si) => (
          <SeasonItem
            key={season.id}
            season={season}
            index={si}
            siblings={seasons}
            onSiblingsChange={setSeasons}
          />
        ))}
      </AccordionRoot>

      {/* 시즌 추가 */}
      <div style={{ marginTop: "24px" }}>
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
          onSubmit={handleAddSeason}
          pending={addSeasonPending}
          trigger={
            <ActionButton variant="brandSolid" size="medium">
              + 시즌 추가
            </ActionButton>
          }
          submitLabel="추가"
        />
      </div>
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
