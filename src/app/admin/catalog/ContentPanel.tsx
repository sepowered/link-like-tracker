"use client";

/**
 * ContentPanel — 콘텐츠 소스 목록 관리 Dialog.
 *
 * - 소스 행: 순서 ↑↓, URL(인라인 편집, http/https만), 라벨(인라인), timestamp_todo(checkbox), 삭제(Confirm).
 * - "+ 소스" 폼: URL, 라벨, timestamp_todo.
 * - legacy_video_id는 읽기전용 표시.
 * - 낙관적 업데이트 + 실패 시 스냅샷 롤백 + toastError 패턴.
 */

import * as React from "react";
import type { AdminContent, AdminContentSource } from "@/lib/admin/catalog-types";
import {
  createContentSourceAction,
  updateContentSourceAction,
  deleteContentSourceAction,
  reorderContentSourcesAction,
} from "@/app/admin/actions/catalog";
import { Dialog, ConfirmDialog, useToast } from "@/app/admin/ui/primitives";

interface ContentPanelProps {
  content: AdminContent;
  onSourcesChanged: (updated: AdminContentSource[]) => void;
  onClose: () => void;
}

export default function ContentPanel({ content, onSourcesChanged, onClose }: ContentPanelProps) {
  const { toast, toastError } = useToast();
  const sources = content.content_sources;

  // 새 소스 폼
  const [newUrl, setNewUrl] = React.useState("");
  const [newLabel, setNewLabel] = React.useState("");
  const [newTimestamp, setNewTimestamp] = React.useState(false);
  const [addBusy, setAddBusy] = React.useState(false);

  // 삭제 확인 대상
  const [deleteTarget, setDeleteTarget] = React.useState<AdminContentSource | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  // ── 재정렬 ──
  function reorderSource(source: AdminContentSource, dir: "up" | "down") {
    const idx = sources.indexOf(source);
    if (idx < 0) return;
    const snapshot = sources;
    const ids = sources.map((s) => s.id);
    const to = dir === "up" ? idx - 1 : idx + 1;
    if (to < 0 || to >= ids.length) return;
    [ids[idx], ids[to]] = [ids[to], ids[idx]];
    const reordered = ids.map((id) => sources.find((s) => s.id === id)!);
    onSourcesChanged(reordered);
    reorderContentSourcesAction(content.id, ids).catch(() => {
      onSourcesChanged(snapshot);
      toastError("소스 순서 변경에 실패했어요.");
    });
  }

  // ── 인라인 편집 커밋 ──
  async function commitSourcePatch(
    source: AdminContentSource,
    patch: { url?: string; label?: string | null; timestamp_todo?: boolean },
  ) {
    const snapshot = sources;
    // 낙관적 업데이트
    onSourcesChanged(sources.map((s) => s.id === source.id ? { ...s, ...patch } : s));
    try {
      const row = await updateContentSourceAction(source.id, patch);
      if (row) {
        onSourcesChanged(sources.map((s) => s.id === source.id ? (row as AdminContentSource) : s));
      }
    } catch (err) {
      onSourcesChanged(snapshot);
      toastError(err instanceof Error ? err.message : "소스 저장에 실패했어요.");
    }
  }

  // ── 소스 추가 ──
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newUrl.trim()) return;
    setAddBusy(true);
    try {
      const row = await createContentSourceAction({
        content_id: content.id,
        url: newUrl.trim(),
        label: newLabel.trim() || null,
        timestamp_todo: newTimestamp,
        sort_order: 0,
      });
      if (!row) return;
      onSourcesChanged([...sources, row as AdminContentSource]);
      setNewUrl("");
      setNewLabel("");
      setNewTimestamp(false);
      toast("소스를 추가했어요.");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "소스 추가에 실패했어요.");
    } finally {
      setAddBusy(false);
    }
  }

  // ── 소스 삭제 ──
  async function handleDelete() {
    if (!deleteTarget) return;
    const snapshot = sources;
    setDeleteBusy(true);
    try {
      await deleteContentSourceAction(deleteTarget.id);
      onSourcesChanged(sources.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast("소스를 삭제했어요.");
    } catch (err) {
      onSourcesChanged(snapshot);
      toastError(err instanceof Error ? err.message : "소스 삭제에 실패했어요.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <Dialog
        open
        wide
        onClose={onClose}
        title={`소스 관리 — ${content.title_ko ?? content.title_jp ?? content.id}`}
        footer={
          <button type="button" className="adm-btn" onClick={onClose}>
            닫기
          </button>
        }
      >
        {/* legacy_video_id 읽기전용 표시 */}
        <div className="adm-field">
          <label>legacy_video_id</label>
          <input
            className="adm-input adm-input--mono"
            value={content.legacy_video_id}
            readOnly
          />
          <span className="adm-field-hint">읽기전용 — 시청 기록 연결 키.</span>
        </div>

        {/* 소스 목록 */}
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th style={{ width: 64 }}>순서</th>
                <th>URL</th>
                <th style={{ width: 120 }}>라벨</th>
                <th style={{ width: 80, textAlign: "center" }}>타임스탬프</th>
                <th style={{ width: 48 }} />
              </tr>
            </thead>
            <tbody>
              {sources.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{ textAlign: "center", padding: "var(--adm-sp-5)", color: "var(--adm-fg-subtle)" }}
                  >
                    소스가 없어요. 아래 폼으로 추가하세요.
                  </td>
                </tr>
              ) : (
                sources.map((src, idx) => (
                  <SourceRow
                    key={src.id}
                    source={src}
                    isFirst={idx === 0}
                    isLast={idx === sources.length - 1}
                    onReorder={reorderSource}
                    onCommit={commitSourcePatch}
                    onDelete={setDeleteTarget}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 소스 추가 폼 */}
        <form onSubmit={handleAdd}>
          <div style={{ borderTop: "1px solid var(--adm-stroke)", paddingTop: "var(--adm-sp-4)" }}>
            <p style={{ margin: "0 0 var(--adm-sp-3)", fontWeight: 700, fontSize: "var(--adm-fs-xs)", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--adm-fg-subtle)" }}>
              소스 추가
            </p>
            <div className="adm-form-grid">
              <div className="adm-field adm-field--full">
                <label>URL</label>
                <input
                  className="adm-input adm-input--mono"
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://…"
                  required
                />
                <span className="adm-field-hint">http/https 만 허용.</span>
              </div>
              <div className="adm-field">
                <label>라벨</label>
                <input
                  className="adm-input"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="선택사항"
                />
              </div>
              <div className="adm-field" style={{ justifyContent: "flex-end" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "var(--adm-sp-2)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={newTimestamp}
                    onChange={(e) => setNewTimestamp(e.target.checked)}
                  />
                  타임스탬프 미정
                </label>
              </div>
            </div>
            <div style={{ marginTop: "var(--adm-sp-3)" }}>
              <button
                type="submit"
                className="adm-btn adm-btn--primary"
                disabled={addBusy || !newUrl.trim()}
              >
                {addBusy ? <span className="adm-spin" /> : null}
                소스 추가
              </button>
            </div>
          </div>
        </form>
      </Dialog>

      {/* 삭제 확인 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="소스 삭제"
        description={
          <span>
            이 소스를 삭제할까요?<br />
            <span className="adm-mono" style={{ fontSize: "var(--adm-fs-xs)", color: "var(--adm-fg-muted)" }}>
              {deleteTarget?.url}
            </span>
          </span>
        }
        confirmLabel="삭제"
        busy={deleteBusy}
      />
    </>
  );
}

// ── 소스 행 (인라인 편집) ─────────────────────────────────────────────────

interface SourceRowProps {
  source: AdminContentSource;
  isFirst: boolean;
  isLast: boolean;
  onReorder: (s: AdminContentSource, dir: "up" | "down") => void;
  onCommit: (s: AdminContentSource, patch: { url?: string; label?: string | null; timestamp_todo?: boolean }) => Promise<void>;
  onDelete: (s: AdminContentSource) => void;
}

function SourceRow({ source, isFirst, isLast, onReorder, onCommit, onDelete }: SourceRowProps) {
  const [url, setUrl] = React.useState(source.url);
  const [label, setLabel] = React.useState(source.label ?? "");

  // 부모 source가 바뀌면(낙관적 업데이트/롤백) 동기화
  React.useEffect(() => { setUrl(source.url); }, [source.url]);
  React.useEffect(() => { setLabel(source.label ?? ""); }, [source.label]);

  function commitUrl(value: string) {
    const trimmed = value.trim();
    if (trimmed === source.url) return;
    onCommit(source, { url: trimmed });
  }

  function commitLabel(value: string) {
    const trimmed = value.trim();
    const next = trimmed === "" ? null : trimmed;
    if (next === source.label) return;
    onCommit(source, { label: next });
  }

  return (
    <tr>
      {/* 순서 */}
      <td>
        <div style={{ display: "flex", gap: 1 }}>
          <button
            type="button"
            className="adm-btn adm-btn--ghost adm-btn--sm"
            disabled={isFirst}
            onClick={() => onReorder(source, "up")}
            aria-label="위로"
          >↑</button>
          <button
            type="button"
            className="adm-btn adm-btn--ghost adm-btn--sm"
            disabled={isLast}
            onClick={() => onReorder(source, "down")}
            aria-label="아래로"
          >↓</button>
        </div>
      </td>

      {/* URL */}
      <td>
        <input
          className="adm-input adm-input--mono"
          style={{ height: 24, width: "100%", fontSize: "var(--adm-fs-xs)" }}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={(e) => commitUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); commitUrl(url); } }}
        />
      </td>

      {/* 라벨 */}
      <td>
        <input
          className="adm-input"
          style={{ height: 24, width: "100%", fontSize: "var(--adm-fs-xs)" }}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={(e) => commitLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); commitLabel(label); } }}
        />
      </td>

      {/* timestamp_todo — checkbox 즉시 커밋 */}
      <td style={{ textAlign: "center" }}>
        <input
          type="checkbox"
          checked={source.timestamp_todo}
          onChange={(e) => onCommit(source, { timestamp_todo: e.target.checked })}
          aria-label="타임스탬프 미정"
        />
      </td>

      {/* 삭제 */}
      <td className="adm-cell-actions">
        <button
          type="button"
          className="adm-btn adm-btn--ghost adm-btn--sm"
          style={{ color: "var(--adm-danger)" }}
          onClick={() => onDelete(source)}
          aria-label="소스 삭제"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
