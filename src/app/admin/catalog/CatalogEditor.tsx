"use client";

/**
 * CatalogEditor — 카탈로그 편집기 메인 (v2 백오피스).
 *
 * 레이아웃: 마스터-디테일(adm-split).
 * - 좌측: 시즌/에피소드 트리. 시즌 클릭=펼침/접기, 에피소드 클릭=선택.
 *   시즌/에피소드 생성·수정·삭제·순서변경은 Dialog 기반.
 * - 우측: 선택된 에피소드의 콘텐츠 테이블 (인라인 편집, 낙관적 업데이트).
 *
 * 패턴: RequestDetail.tsx와 동일 — snapshot 스냅샷 롤백 + toastError.
 * 재정렬은 검색 필터 안 된 전체 id 배열을 서버에 넘긴다(불변 규칙).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import type { AdminSeason, AdminEpisode, AdminContent } from "@/lib/admin/catalog-types";
import type { ContentType } from "@/types";
import type { CategoryOverrideValue } from "@/types";
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
} from "@/app/admin/actions/catalog";
import {
  Dialog,
  ConfirmDialog,
  EmptyState,
  useToast,
} from "@/app/admin/ui/primitives";
import {
  CONTENT_TYPE_OPTIONS,
  CATEGORY_OVERRIDE_OPTIONS,
} from "@/app/admin/ui/labels";
import ContentPanel from "./ContentPanel";
import CsvDialog from "./CsvDialog";

// ── 유틸 ─────────────────────────────────────────────────────────────────

function toOverride(v: string): CategoryOverrideValue {
  return v === "" ? null : (v as CategoryOverrideValue);
}

// ── 시즌 Dialog ──────────────────────────────────────────────────────────

interface SeasonDialogProps {
  mode: "create" | "edit";
  open: boolean;
  onClose: () => void;
  initial?: { id?: string; name: string };
  onSubmit: (data: { id: string; name: string }) => Promise<void>;
  busy: boolean;
}

function SeasonDialog({ mode, open, onClose, initial, onSubmit, busy }: SeasonDialogProps) {
  const [id, setId] = React.useState(initial?.id ?? "");
  const [name, setName] = React.useState(initial?.name ?? "");

  // Dialog 열릴 때마다 초기값으로 리셋
  React.useEffect(() => {
    if (open) {
      setId(initial?.id ?? "");
      setName(initial?.name ?? "");
    }
  }, [open, initial?.id, initial?.name]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({ id: id.trim(), name: name.trim() });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === "create" ? "시즌 추가" : "시즌 편집"}
      footer={
        <>
          <button type="button" className="adm-btn" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button
            type="submit"
            form="season-form"
            className="adm-btn adm-btn--primary"
            disabled={busy || name.trim() === "" || (mode === "create" && id.trim() === "")}
          >
            {busy ? <span className="adm-spin" /> : null}
            {mode === "create" ? "추가" : "저장"}
          </button>
        </>
      }
    >
      <form id="season-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--adm-sp-4)" }}>
        {mode === "create" && (
          <div className="adm-field">
            <label>시즌 ID</label>
            <input
              className="adm-input adm-input--mono"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="예: 103-main"
              required
            />
            <span className="adm-field-hint">생성 후에는 바꿀 수 없어요.</span>
          </div>
        )}
        <div className="adm-field">
          <label>이름</label>
          <input
            className="adm-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 시즌 3"
            required
            autoFocus={mode === "edit"}
          />
        </div>
      </form>
    </Dialog>
  );
}

// ── 에피소드 Dialog ──────────────────────────────────────────────────────

interface EpisodeDialogProps {
  mode: "create" | "edit";
  open: boolean;
  onClose: () => void;
  initial?: { id?: string; episode_number: number; title_ko: string; title_jp: string };
  onSubmit: (data: { id: string; episode_number: number; title_ko: string; title_jp: string }) => Promise<void>;
  busy: boolean;
}

function EpisodeDialog({ mode, open, onClose, initial, onSubmit, busy }: EpisodeDialogProps) {
  const [id, setId] = React.useState(initial?.id ?? "");
  const [epNum, setEpNum] = React.useState(String(initial?.episode_number ?? ""));
  const [titleKo, setTitleKo] = React.useState(initial?.title_ko ?? "");
  const [titleJp, setTitleJp] = React.useState(initial?.title_jp ?? "");

  React.useEffect(() => {
    if (open) {
      setId(initial?.id ?? "");
      setEpNum(String(initial?.episode_number ?? ""));
      setTitleKo(initial?.title_ko ?? "");
      setTitleJp(initial?.title_jp ?? "");
    }
  }, [open, initial?.id, initial?.episode_number, initial?.title_ko, initial?.title_jp]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({
      id: id.trim(),
      episode_number: Number(epNum),
      title_ko: titleKo.trim(),
      title_jp: titleJp.trim(),
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === "create" ? "에피소드 추가" : "에피소드 편집"}
      footer={
        <>
          <button type="button" className="adm-btn" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button
            type="submit"
            form="episode-form"
            className="adm-btn adm-btn--primary"
            disabled={busy || (mode === "create" && id.trim() === "") || epNum.trim() === ""}
          >
            {busy ? <span className="adm-spin" /> : null}
            {mode === "create" ? "추가" : "저장"}
          </button>
        </>
      }
    >
      <form id="episode-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--adm-sp-4)" }}>
        {mode === "create" && (
          <div className="adm-field">
            <label>에피소드 ID</label>
            <input
              className="adm-input adm-input--mono"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="예: ep-103-01"
              required
            />
            <span className="adm-field-hint">생성 후에는 바꿀 수 없어요.</span>
          </div>
        )}
        <div className="adm-field">
          <label>화수</label>
          <input
            className="adm-input adm-input--mono"
            type="number"
            value={epNum}
            onChange={(e) => setEpNum(e.target.value)}
            placeholder="예: 1"
            required
          />
        </div>
        <div className="adm-form-grid">
          <div className="adm-field">
            <label>제목 (한국어)</label>
            <input
              className="adm-input"
              value={titleKo}
              onChange={(e) => setTitleKo(e.target.value)}
            />
          </div>
          <div className="adm-field">
            <label>제목 (일본어)</label>
            <input
              className="adm-input"
              value={titleJp}
              onChange={(e) => setTitleJp(e.target.value)}
            />
          </div>
        </div>
      </form>
    </Dialog>
  );
}

// ── 콘텐츠 추가 Dialog ──────────────────────────────────────────────────

interface ContentCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    id: string;
    legacy_video_id: string;
    type: ContentType;
    title_ko: string;
    title_jp: string;
    part_label: string;
    category_override: string;
  }) => Promise<void>;
  busy: boolean;
}

function ContentCreateDialog({ open, onClose, onSubmit, busy }: ContentCreateDialogProps) {
  const [id, setId] = React.useState("");
  const [legacyId, setLegacyId] = React.useState("");
  const [type, setType] = React.useState<ContentType>("story");
  const [titleKo, setTitleKo] = React.useState("");
  const [titleJp, setTitleJp] = React.useState("");
  const [partLabel, setPartLabel] = React.useState("");
  const [catOverride, setCatOverride] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setId(""); setLegacyId(""); setType("story");
      setTitleKo(""); setTitleJp(""); setPartLabel(""); setCatOverride("");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({ id: id.trim(), legacy_video_id: legacyId.trim(), type, title_ko: titleKo.trim(), title_jp: titleJp.trim(), part_label: partLabel.trim(), category_override: catOverride });
  }

  const canSubmit = !busy && id.trim() !== "" && legacyId.trim() !== "";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="콘텐츠 추가"
      footer={
        <>
          <button type="button" className="adm-btn" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button
            type="submit"
            form="content-create-form"
            className="adm-btn adm-btn--primary"
            disabled={!canSubmit}
          >
            {busy ? <span className="adm-spin" /> : null}
            추가
          </button>
        </>
      }
    >
      <form id="content-create-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--adm-sp-4)" }}>
        <div className="adm-form-grid">
          <div className="adm-field">
            <label>콘텐츠 ID</label>
            <input
              className="adm-input adm-input--mono"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="예: dQw4w9WgXcQ"
              required
            />
          </div>
          <div className="adm-field">
            <label>legacy_video_id</label>
            <input
              className="adm-input adm-input--mono"
              value={legacyId}
              onChange={(e) => setLegacyId(e.target.value)}
              required
            />
            <span className="adm-field-hint">생성 후 수정 불가 — 시청 기록 연결 키.</span>
          </div>
          <div className="adm-field">
            <label>타입</label>
            <select
              className="adm-select"
              value={type}
              onChange={(e) => setType(e.target.value as ContentType)}
            >
              {CONTENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="adm-field">
            <label>분류 덮어쓰기</label>
            <select
              className="adm-select"
              value={catOverride}
              onChange={(e) => setCatOverride(e.target.value)}
            >
              {CATEGORY_OVERRIDE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="adm-field">
            <label>제목 (한국어)</label>
            <input
              className="adm-input"
              value={titleKo}
              onChange={(e) => setTitleKo(e.target.value)}
            />
          </div>
          <div className="adm-field">
            <label>제목 (일본어)</label>
            <input
              className="adm-input"
              value={titleJp}
              onChange={(e) => setTitleJp(e.target.value)}
            />
          </div>
          <div className="adm-field">
            <label>파트</label>
            <input
              className="adm-input adm-input--mono"
              value={partLabel}
              onChange={(e) => setPartLabel(e.target.value)}
              placeholder="예: Part 1"
            />
          </div>
        </div>
      </form>
    </Dialog>
  );
}

// ── 트리 패널 ────────────────────────────────────────────────────────────

interface TreePanelProps {
  seasons: AdminSeason[];
  selectedEpisodeId: string | null;
  onEpisodeSelect: (ep: AdminEpisode) => void;
  onSeasonsChange: (seasons: AdminSeason[]) => void;
}

function TreePanel({ seasons, selectedEpisodeId, onEpisodeSelect, onSeasonsChange }: TreePanelProps) {
  const { toast, toastError } = useToast();

  // 열린 시즌 id 집합 (초기: 모두 열기)
  const [openSeasonIds, setOpenSeasonIds] = React.useState<Set<string>>(
    () => new Set(seasons.map((s) => s.id)),
  );

  // 시즌 Dialog 상태
  const [seasonCreateOpen, setSeasonCreateOpen] = React.useState(false);
  const [seasonEditTarget, setSeasonEditTarget] = React.useState<AdminSeason | null>(null);
  const [seasonDeleteTarget, setSeasonDeleteTarget] = React.useState<AdminSeason | null>(null);
  const [seasonBusy, setSeasonBusy] = React.useState(false);

  // 에피소드 Dialog 상태
  const [epCreateSeasonId, setEpCreateSeasonId] = React.useState<string | null>(null);
  const [epEditTarget, setEpEditTarget] = React.useState<AdminEpisode | null>(null);
  const [epDeleteTarget, setEpDeleteTarget] = React.useState<AdminEpisode | null>(null);
  const [epBusy, setEpBusy] = React.useState(false);

  function toggleSeason(id: string) {
    setOpenSeasonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── 시즌 재정렬 ──
  function reorderSeasonBy(season: AdminSeason, dir: "up" | "down") {
    const idx = seasons.indexOf(season);
    if (idx < 0) return;
    const snapshot = seasons;
    const ids = seasons.map((s) => s.id);
    const to = dir === "up" ? idx - 1 : idx + 1;
    if (to < 0 || to >= ids.length) return;
    [ids[idx], ids[to]] = [ids[to], ids[idx]];
    const reordered = ids.map((id) => seasons.find((s) => s.id === id)!);
    onSeasonsChange(reordered);
    reorderSeasonsAction(ids).catch(() => {
      onSeasonsChange(snapshot);
      toastError("시즌 순서 변경에 실패했어요.");
    });
  }

  // ── 시즌 생성 ──
  async function handleSeasonCreate(data: { id: string; name: string }) {
    setSeasonBusy(true);
    try {
      const row = await createSeasonAction({ id: data.id, name: data.name, sort_order: 0 });
      if (!row) return;
      const newSeason: AdminSeason = { ...(row as Omit<AdminSeason, "episodes">), episodes: [] };
      onSeasonsChange([...seasons, newSeason]);
      setOpenSeasonIds((prev) => new Set([...prev, newSeason.id]));
      setSeasonCreateOpen(false);
      toast(`시즌 "${data.name}"을 추가했어요.`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "시즌 추가에 실패했어요.");
    } finally {
      setSeasonBusy(false);
    }
  }

  // ── 시즌 수정 ──
  async function handleSeasonEdit(data: { id: string; name: string }) {
    if (!seasonEditTarget) return;
    const snapshot = seasons;
    setSeasonBusy(true);
    try {
      await updateSeasonAction(seasonEditTarget.id, { name: data.name });
      onSeasonsChange(seasons.map((s) => s.id === seasonEditTarget.id ? { ...s, name: data.name } : s));
      setSeasonEditTarget(null);
      toast("시즌 이름을 저장했어요.");
    } catch (err) {
      onSeasonsChange(snapshot);
      toastError(err instanceof Error ? err.message : "시즌 저장에 실패했어요.");
    } finally {
      setSeasonBusy(false);
    }
  }

  // ── 시즌 삭제 ──
  async function handleSeasonDelete() {
    if (!seasonDeleteTarget) return;
    const snapshot = seasons;
    setSeasonBusy(true);
    try {
      await deleteSeasonAction(seasonDeleteTarget.id);
      onSeasonsChange(seasons.filter((s) => s.id !== seasonDeleteTarget.id));
      setSeasonDeleteTarget(null);
      toast("시즌을 삭제했어요.");
    } catch (err) {
      onSeasonsChange(snapshot);
      toastError(err instanceof Error ? err.message : "시즌 삭제에 실패했어요.");
    } finally {
      setSeasonBusy(false);
    }
  }

  // ── 에피소드 재정렬 ──
  function reorderEpisodeBy(season: AdminSeason, ep: AdminEpisode, dir: "up" | "down") {
    const episodes = season.episodes;
    const idx = episodes.indexOf(ep);
    if (idx < 0) return;
    const snapshot = seasons;
    const ids = episodes.map((e) => e.id);
    const to = dir === "up" ? idx - 1 : idx + 1;
    if (to < 0 || to >= ids.length) return;
    [ids[idx], ids[to]] = [ids[to], ids[idx]];
    const reordered = ids.map((id) => episodes.find((e) => e.id === id)!);
    onSeasonsChange(seasons.map((s) => s.id === season.id ? { ...s, episodes: reordered } : s));
    reorderEpisodesAction(season.id, ids).catch(() => {
      onSeasonsChange(snapshot);
      toastError("에피소드 순서 변경에 실패했어요.");
    });
  }

  // ── 에피소드 생성 ──
  async function handleEpisodeCreate(data: { id: string; episode_number: number; title_ko: string; title_jp: string }) {
    if (!epCreateSeasonId) return;
    setEpBusy(true);
    try {
      const row = await createEpisodeAction({
        id: data.id,
        season_id: epCreateSeasonId,
        episode_number: data.episode_number,
        title_ko: data.title_ko || null,
        title_jp: data.title_jp || null,
        sort_order: 0,
      });
      if (!row) return;
      const newEp: AdminEpisode = { ...(row as Omit<AdminEpisode, "contents">), contents: [] };
      onSeasonsChange(seasons.map((s) =>
        s.id === epCreateSeasonId ? { ...s, episodes: [...s.episodes, newEp] } : s,
      ));
      setEpCreateSeasonId(null);
      toast(`에피소드 ${data.episode_number}화를 추가했어요.`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "에피소드 추가에 실패했어요.");
    } finally {
      setEpBusy(false);
    }
  }

  // ── 에피소드 수정 ──
  async function handleEpisodeEdit(data: { id: string; episode_number: number; title_ko: string; title_jp: string }) {
    if (!epEditTarget) return;
    const seasonId = epEditTarget.season_id;
    const snapshot = seasons;
    setEpBusy(true);
    try {
      await updateEpisodeAction(epEditTarget.id, {
        episode_number: data.episode_number,
        title_ko: data.title_ko || null,
        title_jp: data.title_jp || null,
      });
      onSeasonsChange(seasons.map((s) =>
        s.id === seasonId
          ? {
              ...s,
              episodes: s.episodes.map((e) =>
                e.id === epEditTarget.id
                  ? { ...e, episode_number: data.episode_number, title_ko: data.title_ko || null, title_jp: data.title_jp || null }
                  : e,
              ),
            }
          : s,
      ));
      setEpEditTarget(null);
      toast("에피소드 정보를 저장했어요.");
    } catch (err) {
      onSeasonsChange(snapshot);
      toastError(err instanceof Error ? err.message : "에피소드 저장에 실패했어요.");
    } finally {
      setEpBusy(false);
    }
  }

  // ── 에피소드 삭제 ──
  async function handleEpisodeDelete() {
    if (!epDeleteTarget) return;
    const seasonId = epDeleteTarget.season_id;
    const snapshot = seasons;
    setEpBusy(true);
    try {
      await deleteEpisodeAction(epDeleteTarget.id);
      onSeasonsChange(seasons.map((s) =>
        s.id === seasonId
          ? { ...s, episodes: s.episodes.filter((e) => e.id !== epDeleteTarget.id) }
          : s,
      ));
      setEpDeleteTarget(null);
      toast("에피소드를 삭제했어요.");
    } catch (err) {
      onSeasonsChange(snapshot);
      toastError(err instanceof Error ? err.message : "에피소드 삭제에 실패했어요.");
    } finally {
      setEpBusy(false);
    }
  }

  return (
    <div className="adm-split-list" style={{ width: 280, minWidth: 220, maxWidth: 320 }}>
      {/* 트리 툴바 */}
      <div className="adm-toolbar">
        <span style={{ fontWeight: 700, fontSize: "var(--adm-fs-sm)", color: "var(--adm-fg-muted)" }}>
          시즌 / 에피소드
        </span>
        <button
          type="button"
          className="adm-btn adm-btn--sm"
          style={{ marginLeft: "auto" }}
          onClick={() => setSeasonCreateOpen(true)}
        >
          + 시즌
        </button>
      </div>

      {/* 트리 */}
      <div className="adm-tree">
        {seasons.length === 0 && (
          <EmptyState title="시즌 없음" hint="+ 시즌으로 만드세요." />
        )}
        {seasons.map((season, sIdx) => {
          const isOpen = openSeasonIds.has(season.id);
          return (
            <div key={season.id}>
              {/* 시즌 행 */}
              <div className="adm-tree-row">
                <button
                  type="button"
                  className="adm-tree-season"
                  data-open={isOpen}
                  style={{ flex: 1 }}
                  onClick={() => toggleSeason(season.id)}
                >
                  {/* 삼각형 아이콘 (CSS transition으로 회전) */}
                  <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                    <path d="M4 2.5l4 3.5-4 3.5z" />
                  </svg>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {season.name}
                  </span>
                </button>
                {/* 시즌 액션 메뉴 — 행 호버 시 표시 */}
                <div className="adm-tree-actions">
                  <button
                    type="button"
                    className="adm-btn adm-btn--ghost adm-btn--sm"
                    title="위로"
                    disabled={sIdx === 0}
                    onClick={() => reorderSeasonBy(season, "up")}
                    aria-label="시즌 위로"
                  >↑</button>
                  <button
                    type="button"
                    className="adm-btn adm-btn--ghost adm-btn--sm"
                    title="아래로"
                    disabled={sIdx === seasons.length - 1}
                    onClick={() => reorderSeasonBy(season, "down")}
                    aria-label="시즌 아래로"
                  >↓</button>
                  <button
                    type="button"
                    className="adm-btn adm-btn--ghost adm-btn--sm"
                    title="편집"
                    onClick={() => setSeasonEditTarget(season)}
                    aria-label="시즌 편집"
                  >✎</button>
                  <button
                    type="button"
                    className="adm-btn adm-btn--ghost adm-btn--sm"
                    title="삭제"
                    style={{ color: "var(--adm-danger)" }}
                    onClick={() => setSeasonDeleteTarget(season)}
                    aria-label="시즌 삭제"
                  >✕</button>
                </div>
              </div>

              {/* 에피소드 목록 */}
              {isOpen && (
                <div>
                  {season.episodes.map((ep, eIdx) => (
                    <div key={ep.id} className="adm-tree-row">
                      <button
                        type="button"
                        className="adm-tree-episode"
                        data-active={ep.id === selectedEpisodeId}
                        style={{ flex: 1 }}
                        onClick={() => onEpisodeSelect(ep)}
                      >
                        <span className="adm-tree-label">
                          {ep.episode_number}화{ep.title_ko ? ` ${ep.title_ko}` : ""}
                        </span>
                        <span className="adm-tree-count">{ep.contents.length}</span>
                      </button>
                      {/* 에피소드 액션 — 행 호버 시 표시 */}
                      <div className="adm-tree-actions">
                        <button
                          type="button"
                          className="adm-btn adm-btn--ghost adm-btn--sm"
                          disabled={eIdx === 0}
                          onClick={() => reorderEpisodeBy(season, ep, "up")}
                          aria-label="에피소드 위로"
                        >↑</button>
                        <button
                          type="button"
                          className="adm-btn adm-btn--ghost adm-btn--sm"
                          disabled={eIdx === season.episodes.length - 1}
                          onClick={() => reorderEpisodeBy(season, ep, "down")}
                          aria-label="에피소드 아래로"
                        >↓</button>
                        <button
                          type="button"
                          className="adm-btn adm-btn--ghost adm-btn--sm"
                          onClick={() => setEpEditTarget(ep)}
                          aria-label="에피소드 편집"
                        >✎</button>
                        <button
                          type="button"
                          className="adm-btn adm-btn--ghost adm-btn--sm"
                          style={{ color: "var(--adm-danger)" }}
                          onClick={() => setEpDeleteTarget(ep)}
                          aria-label="에피소드 삭제"
                        >✕</button>
                      </div>
                    </div>
                  ))}
                  {/* + 에피소드 버튼 */}
                  <button
                    type="button"
                    className="adm-tree-episode"
                    style={{ color: "var(--adm-accent)", paddingLeft: 26 }}
                    onClick={() => setEpCreateSeasonId(season.id)}
                  >
                    <span className="adm-tree-label">+ 에피소드</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dialogs */}
      <SeasonDialog
        mode="create"
        open={seasonCreateOpen}
        onClose={() => setSeasonCreateOpen(false)}
        onSubmit={handleSeasonCreate}
        busy={seasonBusy}
      />
      <SeasonDialog
        mode="edit"
        open={seasonEditTarget !== null}
        onClose={() => setSeasonEditTarget(null)}
        initial={seasonEditTarget ?? undefined}
        onSubmit={handleSeasonEdit}
        busy={seasonBusy}
      />
      <ConfirmDialog
        open={seasonDeleteTarget !== null}
        onClose={() => setSeasonDeleteTarget(null)}
        onConfirm={handleSeasonDelete}
        title="시즌 삭제"
        description={
          <span>
            시즌 <strong>{seasonDeleteTarget?.name}</strong>을 삭제할까요?<br />
            <span style={{ color: "var(--adm-danger)" }}>
              하위 에피소드·콘텐츠·소스가 모두 삭제됩니다.
            </span>
          </span>
        }
        confirmLabel="삭제"
        busy={seasonBusy}
      />
      <EpisodeDialog
        mode="create"
        open={epCreateSeasonId !== null}
        onClose={() => setEpCreateSeasonId(null)}
        onSubmit={handleEpisodeCreate}
        busy={epBusy}
      />
      <EpisodeDialog
        mode="edit"
        open={epEditTarget !== null}
        onClose={() => setEpEditTarget(null)}
        initial={
          epEditTarget
            ? {
                id: epEditTarget.id,
                episode_number: epEditTarget.episode_number,
                title_ko: epEditTarget.title_ko ?? "",
                title_jp: epEditTarget.title_jp ?? "",
              }
            : undefined
        }
        onSubmit={handleEpisodeEdit}
        busy={epBusy}
      />
      <ConfirmDialog
        open={epDeleteTarget !== null}
        onClose={() => setEpDeleteTarget(null)}
        onConfirm={handleEpisodeDelete}
        title="에피소드 삭제"
        description={
          <span>
            에피소드 <strong>{epDeleteTarget?.episode_number}화</strong>를 삭제할까요?<br />
            <span style={{ color: "var(--adm-danger)" }}>
              하위 콘텐츠·소스가 모두 삭제됩니다.
            </span>
          </span>
        }
        confirmLabel="삭제"
        busy={epBusy}
      />
    </div>
  );
}

// ── 콘텐츠 테이블 ────────────────────────────────────────────────────────

interface ContentsTableProps {
  episode: AdminEpisode;
  onEpisodeChange: (ep: AdminEpisode) => void;
}

function ContentsTable({ episode, onEpisodeChange }: ContentsTableProps) {
  const { toast, toastError } = useToast();
  const [query, setQuery] = React.useState("");
  const [contentCreateOpen, setContentCreateOpen] = React.useState(false);
  const [contentBusy, setContentBusy] = React.useState(false);
  const [contentDeleteTarget, setContentDeleteTarget] = React.useState<AdminContent | null>(null);
  // 소스 패널 열기 대상
  const [sourcePanelContent, setSourcePanelContent] = React.useState<AdminContent | null>(null);

  const contents = episode.contents;

  // 검색은 표시용. 재정렬 시에는 contents 전체(필터 안 된) 배열의 id를 사용한다.
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contents;
    return contents.filter(
      (c) =>
        (c.title_ko ?? "").toLowerCase().includes(q) ||
        (c.title_jp ?? "").toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    );
  }, [contents, query]);

  const isFiltered = query.trim() !== "";

  function handleContentsChange(updated: AdminContent[]) {
    onEpisodeChange({ ...episode, contents: updated });
  }

  // ── 재정렬 ── (검색 중 disabled)
  function reorderContent(content: AdminContent, dir: "up" | "down") {
    const idx = contents.indexOf(content);
    if (idx < 0) return;
    const snapshot = contents;
    const ids = contents.map((c) => c.id);
    const to = dir === "up" ? idx - 1 : idx + 1;
    if (to < 0 || to >= ids.length) return;
    [ids[idx], ids[to]] = [ids[to], ids[idx]];
    const reordered = ids.map((id) => contents.find((c) => c.id === id)!);
    handleContentsChange(reordered);
    reorderContentsAction(episode.id, ids).catch(() => {
      handleContentsChange(snapshot);
      toastError("콘텐츠 순서 변경에 실패했어요.");
    });
  }

  // ── 인라인 편집 커밋 ──
  async function commitContentPatch(
    content: AdminContent,
    patch: Parameters<typeof updateContentAction>[1],
  ) {
    const snapshot = contents;
    // 낙관적 업데이트
    handleContentsChange(contents.map((c) => c.id === content.id ? { ...c, ...patch } : c));
    try {
      const row = await updateContentAction(content.id, patch);
      if (row) {
        handleContentsChange(contents.map((c) => c.id === content.id ? { ...(row as AdminContent), content_sources: c.content_sources } : c));
      }
    } catch (err) {
      handleContentsChange(snapshot);
      toastError(err instanceof Error ? err.message : "저장에 실패했어요.");
    }
  }

  // ── 콘텐츠 추가 ──
  async function handleContentCreate(data: {
    id: string; legacy_video_id: string; type: ContentType;
    title_ko: string; title_jp: string; part_label: string; category_override: string;
  }) {
    setContentBusy(true);
    try {
      const row = await createContentAction({
        id: data.id,
        episode_id: episode.id,
        type: data.type,
        title_ko: data.title_ko || null,
        title_jp: data.title_jp || null,
        part_label: data.part_label || null,
        legacy_video_id: data.legacy_video_id,
        sort_order: 0,
        category_override: toOverride(data.category_override),
      });
      if (!row) return;
      const newContent: AdminContent = { ...(row as Omit<AdminContent, "content_sources">), content_sources: [] };
      handleContentsChange([...contents, newContent]);
      setContentCreateOpen(false);
      toast("콘텐츠를 추가했어요.");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "콘텐츠 추가에 실패했어요.");
    } finally {
      setContentBusy(false);
    }
  }

  // ── 콘텐츠 삭제 ──
  async function handleContentDelete() {
    if (!contentDeleteTarget) return;
    const snapshot = contents;
    setContentBusy(true);
    try {
      await deleteContentAction(contentDeleteTarget.id);
      handleContentsChange(contents.filter((c) => c.id !== contentDeleteTarget.id));
      setContentDeleteTarget(null);
      toast("콘텐츠를 삭제했어요.");
    } catch (err) {
      handleContentsChange(snapshot);
      toastError(err instanceof Error ? err.message : "콘텐츠 삭제에 실패했어요.");
    } finally {
      setContentBusy(false);
    }
  }

  // 소스 패널에서 content_sources 변경 시 로컬 트리 갱신
  function handleSourcesChanged(contentId: string, updated: AdminContent["content_sources"]) {
    handleContentsChange(contents.map((c) => c.id === contentId ? { ...c, content_sources: updated } : c));
    // 소스 패널 내 컨텐츠도 최신으로 유지
    if (sourcePanelContent?.id === contentId) {
      setSourcePanelContent((prev) => prev ? { ...prev, content_sources: updated } : prev);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* 툴바 */}
      <div className="adm-toolbar">
        <div className="adm-search" style={{ flex: 1 }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="4" />
            <path d="M10 10l3 3" strokeLinecap="round" />
          </svg>
          <input
            className="adm-input"
            placeholder="ID·제목 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="adm-btn adm-btn--primary adm-btn--sm"
          onClick={() => setContentCreateOpen(true)}
        >
          + 콘텐츠
        </button>
      </div>

      {/* 테이블 */}
      <div className="adm-table-wrap" style={{ flex: 1 }}>
        <table className="adm-table">
          <thead>
            <tr>
              <th style={{ width: 64 }}>순서</th>
              <th style={{ width: 120 }}>ID</th>
              <th style={{ width: 100 }}>타입</th>
              <th>제목 ko</th>
              <th>제목 jp</th>
              <th style={{ width: 80 }}>파트</th>
              <th style={{ width: 130 }}>분류 덮어쓰기</th>
              <th style={{ width: 60 }}>소스</th>
              <th style={{ width: 48 }} className="adm-cell-actions" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "var(--adm-sp-8)", color: "var(--adm-fg-subtle)" }}>
                  {isFiltered ? "검색 결과가 없어요." : "콘텐츠가 없어요. + 콘텐츠로 추가하세요."}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <ContentRow
                  key={c.id}
                  content={c}
                  allContents={contents}
                  isFiltered={isFiltered}
                  onReorder={reorderContent}
                  onCommit={commitContentPatch}
                  onDelete={setContentDeleteTarget}
                  onOpenSources={setSourcePanelContent}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 소스 패널 Dialog */}
      {sourcePanelContent && (
        <ContentPanel
          content={sourcePanelContent}
          onSourcesChanged={(updated) => handleSourcesChanged(sourcePanelContent.id, updated)}
          onClose={() => setSourcePanelContent(null)}
        />
      )}

      {/* 콘텐츠 추가 Dialog */}
      <ContentCreateDialog
        open={contentCreateOpen}
        onClose={() => setContentCreateOpen(false)}
        onSubmit={handleContentCreate}
        busy={contentBusy}
      />

      {/* 콘텐츠 삭제 확인 */}
      <ConfirmDialog
        open={contentDeleteTarget !== null}
        onClose={() => setContentDeleteTarget(null)}
        onConfirm={handleContentDelete}
        title="콘텐츠 삭제"
        description={
          <span>
            <strong>{contentDeleteTarget?.title_ko ?? contentDeleteTarget?.id}</strong>을 삭제할까요?<br />
            <span style={{ color: "var(--adm-danger)" }}>
              하위 소스가 모두 삭제됩니다.<br />
              legacy_video_id({contentDeleteTarget?.legacy_video_id})를 참조하는
              user_progress 시청 기록이 고아가 됩니다 — 기존 유저 시청 데이터 보존이 최상위 제약입니다.
            </span>
          </span>
        }
        confirmLabel="삭제"
        busy={contentBusy}
      />
    </div>
  );
}

// ── 콘텐츠 행 (인라인 편집) ──────────────────────────────────────────────

interface ContentRowProps {
  content: AdminContent;
  allContents: AdminContent[];
  isFiltered: boolean;
  onReorder: (c: AdminContent, dir: "up" | "down") => void;
  onCommit: (c: AdminContent, patch: Parameters<typeof updateContentAction>[1]) => Promise<void>;
  onDelete: (c: AdminContent) => void;
  onOpenSources: (c: AdminContent) => void;
}

function ContentRow({ content, allContents, isFiltered, onReorder, onCommit, onDelete, onOpenSources }: ContentRowProps) {
  const idx = allContents.indexOf(content);
  const isFirst = idx === 0;
  const isLast = idx === allContents.length - 1;

  // 인라인 편집 로컬 상태 — 커밋 방식: onBlur/Enter(input), onChange(select)
  const [titleKo, setTitleKo] = React.useState(content.title_ko ?? "");
  const [titleJp, setTitleJp] = React.useState(content.title_jp ?? "");
  const [partLabel, setPartLabel] = React.useState(content.part_label ?? "");

  // 부모 content가 바뀌면(낙관적 업데이트/롤백) 로컬 상태도 동기화
  React.useEffect(() => { setTitleKo(content.title_ko ?? ""); }, [content.title_ko]);
  React.useEffect(() => { setTitleJp(content.title_jp ?? ""); }, [content.title_jp]);
  React.useEffect(() => { setPartLabel(content.part_label ?? ""); }, [content.part_label]);

  function commitText(field: "title_ko" | "title_jp" | "part_label", value: string) {
    const trimmed = value.trim() === "" ? null : value.trim();
    if (trimmed === (content[field] ?? null)) return; // 변경 없으면 skip
    onCommit(content, { [field]: trimmed });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, field: "title_ko" | "title_jp" | "part_label", value: string) {
    if (e.key === "Enter") {
      e.currentTarget.blur();
      commitText(field, value);
    }
  }

  return (
    <tr>
      {/* 순서 */}
      <td>
        <div style={{ display: "flex", gap: 1 }}>
          <button
            type="button"
            className="adm-btn adm-btn--ghost adm-btn--sm"
            disabled={isFirst || isFiltered}
            onClick={() => onReorder(content, "up")}
            aria-label="위로"
            title={isFiltered ? "검색 중에는 순서를 바꿀 수 없어요" : "위로"}
          >↑</button>
          <button
            type="button"
            className="adm-btn adm-btn--ghost adm-btn--sm"
            disabled={isLast || isFiltered}
            onClick={() => onReorder(content, "down")}
            aria-label="아래로"
            title={isFiltered ? "검색 중에는 순서를 바꿀 수 없어요" : "아래로"}
          >↓</button>
        </div>
      </td>

      {/* ID */}
      <td className="adm-cell-mono" style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
        {content.id}
      </td>

      {/* 타입 — onChange 즉시 커밋 */}
      <td>
        <select
          className="adm-select"
          style={{ height: 24, fontSize: "var(--adm-fs-xs)" }}
          value={content.type}
          onChange={(e) => onCommit(content, { type: e.target.value as ContentType })}
        >
          {CONTENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>

      {/* 제목 ko */}
      <td>
        <input
          className="adm-input"
          style={{ height: 24, width: "100%", fontSize: "var(--adm-fs-xs)" }}
          value={titleKo}
          onChange={(e) => setTitleKo(e.target.value)}
          onBlur={(e) => commitText("title_ko", e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, "title_ko", titleKo)}
        />
      </td>

      {/* 제목 jp */}
      <td>
        <input
          className="adm-input"
          style={{ height: 24, width: "100%", fontSize: "var(--adm-fs-xs)" }}
          value={titleJp}
          onChange={(e) => setTitleJp(e.target.value)}
          onBlur={(e) => commitText("title_jp", e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, "title_jp", titleJp)}
        />
      </td>

      {/* 파트 */}
      <td>
        <input
          className="adm-input adm-input--mono"
          style={{ height: 24, width: "100%", fontSize: "var(--adm-fs-xs)" }}
          value={partLabel}
          onChange={(e) => setPartLabel(e.target.value)}
          onBlur={(e) => commitText("part_label", e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, "part_label", partLabel)}
        />
      </td>

      {/* 분류 덮어쓰기 — onChange 즉시 커밋 */}
      <td>
        <select
          className="adm-select"
          style={{ height: 24, fontSize: "var(--adm-fs-xs)" }}
          value={content.category_override ?? ""}
          onChange={(e) => onCommit(content, { category_override: toOverride(e.target.value) })}
        >
          {CATEGORY_OVERRIDE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>

      {/* 소스 수 — 클릭 시 ContentPanel 열기 */}
      <td style={{ textAlign: "center" }}>
        <button
          type="button"
          className="adm-btn adm-btn--ghost adm-btn--sm"
          onClick={() => onOpenSources(content)}
          title="소스 관리"
        >
          <span className="adm-mono">{content.content_sources.length}</span>
        </button>
      </td>

      {/* 삭제 */}
      <td className="adm-cell-actions">
        <button
          type="button"
          className="adm-btn adm-btn--ghost adm-btn--sm"
          style={{ color: "var(--adm-danger)" }}
          onClick={() => onDelete(content)}
          aria-label="콘텐츠 삭제"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

// ── CatalogEditor 메인 ──────────────────────────────────────────────────

export default function CatalogEditor({ initialSeasons }: { initialSeasons: AdminSeason[] }) {
  const router = useRouter();
  const [seasons, setSeasons] = React.useState<AdminSeason[]>(initialSeasons);
  const [selectedEpisodeId, setSelectedEpisodeId] = React.useState<string | null>(null);
  const [csvExportOpen, setCsvExportOpen] = React.useState(false);
  const [csvImportOpen, setCsvImportOpen] = React.useState(false);

  // 선택된 에피소드 (seasons 트리에서 찾기)
  const selectedEpisode = React.useMemo(() => {
    for (const s of seasons) {
      const ep = s.episodes.find((e) => e.id === selectedEpisodeId);
      if (ep) return ep;
    }
    return null;
  }, [seasons, selectedEpisodeId]);

  function handleEpisodeChange(updated: AdminEpisode) {
    setSeasons((prev) =>
      prev.map((s) =>
        s.id === updated.season_id
          ? { ...s, episodes: s.episodes.map((e) => e.id === updated.id ? updated : e) }
          : s,
      ),
    );
  }

  return (
    <div className="adm-page">
      {/* 헤더 */}
      <header className="adm-page-head">
        <h1 className="adm-page-title">카탈로그</h1>
        <div className="adm-page-head-actions">
          <button
            type="button"
            className="adm-btn"
            onClick={() => setCsvExportOpen(true)}
          >
            CSV 내보내기
          </button>
          <button
            type="button"
            className="adm-btn"
            onClick={() => setCsvImportOpen(true)}
          >
            CSV 가져오기
          </button>
        </div>
      </header>

      {/* 바디 */}
      <div className="adm-page-body adm-page-body--flush">
        <div className="adm-split">
          {/* 좌측: 트리 */}
          <TreePanel
            seasons={seasons}
            selectedEpisodeId={selectedEpisodeId}
            onEpisodeSelect={(ep) => setSelectedEpisodeId(ep.id)}
            onSeasonsChange={setSeasons}
          />

          {/* 우측: 콘텐츠 테이블 */}
          <div className="adm-split-detail">
            {selectedEpisode ? (
              <ContentsTable
                key={selectedEpisode.id}
                episode={selectedEpisode}
                onEpisodeChange={handleEpisodeChange}
              />
            ) : (
              <EmptyState
                title="에피소드를 선택하세요"
                hint="왼쪽 트리에서 에피소드를 고르면 콘텐츠 목록이 표시돼요."
              />
            )}
          </div>
        </div>
      </div>

      {/* CSV Dialogs */}
      <CsvDialog
        mode="export"
        open={csvExportOpen}
        onClose={() => setCsvExportOpen(false)}
      />
      <CsvDialog
        mode="import"
        open={csvImportOpen}
        onClose={() => setCsvImportOpen(false)}
        onImported={() => router.refresh()}
      />
    </div>
  );
}
