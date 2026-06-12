"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { AnnouncementRow, AnnouncementInput } from "@/lib/admin/announcements-types";
import { formatAnnouncementDate } from "@/lib/admin/announcements-types";
import {
  Dialog,
  ConfirmDialog,
  EmptyState,
  ToastProvider,
  useToast,
} from "@/app/admin/ui/primitives";
import {
  createAnnouncementAction,
  updateAnnouncementAction,
  deleteAnnouncementAction,
} from "@/app/admin/actions/announcements";

// ── 유효성 검사 ───────────────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

function validateSlug(slug: string): string | null {
  if (!slug.trim()) return "slug를 입력해 주세요.";
  if (!SLUG_RE.test(slug)) return "slug는 소문자·숫자·하이픈만 허용되며 소문자·숫자로 시작해야 합니다.";
  return null;
}

function validateInput(
  input: AnnouncementInput,
  isNew: boolean,
): string | null {
  if (isNew) {
    const slugErr = validateSlug(input.slug);
    if (slugErr) return slugErr;
  }
  if (!input.title.trim()) return "제목을 입력해 주세요.";
  if (!input.summary.trim()) return "한 줄 요약을 입력해 주세요.";
  if (!input.body_md.trim()) return "본문을 입력해 주세요.";
  if (!input.published_at.trim()) return "게시일을 입력해 주세요.";
  return null;
}

// ── 폼 초기값 ─────────────────────────────────────────────────────────────

function emptyInput(): AnnouncementInput {
  return {
    slug: "",
    title: "",
    banner_title: null,
    summary: "",
    body_md: "",
    published_at: new Date().toISOString().slice(0, 10),
    is_published: false,
  };
}

function rowToInput(row: AnnouncementRow): AnnouncementInput {
  return {
    slug: row.slug,
    title: row.title,
    banner_title: row.banner_title,
    summary: row.summary,
    body_md: row.body_md,
    published_at: row.published_at,
    is_published: row.is_published,
  };
}

// ── 공지 폼 (생성/수정 공용) ──────────────────────────────────────────────

function AnnouncementForm({
  initial,
  isNew,
  onSubmit,
  onCancel,
  busy,
}: {
  initial: AnnouncementInput;
  isNew: boolean;
  onSubmit: (input: AnnouncementInput) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [form, setForm] = React.useState<AnnouncementInput>(initial);
  const [clientError, setClientError] = React.useState<string | null>(null);

  function set<K extends keyof AnnouncementInput>(key: K, value: AnnouncementInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setClientError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateInput(form, isNew);
    if (err) {
      setClientError(err);
      return;
    }
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--adm-sp-4)" }}>
      <div className="adm-form-grid">
        {/* slug */}
        <div className="adm-field">
          <label htmlFor="ann-slug">slug</label>
          <input
            id="ann-slug"
            className={`adm-input adm-input--mono${!isNew ? " adm-input--readonly" : ""}`}
            value={form.slug}
            readOnly={!isNew}
            onChange={(e) => set("slug", e.target.value)}
            placeholder="my-update-2026"
            autoComplete="off"
          />
        </div>

        {/* 게시일 */}
        <div className="adm-field">
          <label htmlFor="ann-published-at">게시일</label>
          <input
            id="ann-published-at"
            type="date"
            className="adm-input"
            value={form.published_at}
            onChange={(e) => set("published_at", e.target.value)}
          />
        </div>

        {/* 제목 */}
        <div className="adm-field adm-field--full">
          <label htmlFor="ann-title">제목</label>
          <input
            id="ann-title"
            className="adm-input"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="공지 제목"
          />
        </div>

        {/* 배너 제목 */}
        <div className="adm-field adm-field--full">
          <label htmlFor="ann-banner-title">배너 제목 (선택)</label>
          <input
            id="ann-banner-title"
            className="adm-input"
            value={form.banner_title ?? ""}
            onChange={(e) => set("banner_title", e.target.value || null)}
            placeholder="비우면 제목이 배너에 사용됩니다"
          />
          <span className="adm-field-hint">비워두면 메인 배너에 &lsquo;제목&rsquo; 필드가 사용됩니다.</span>
        </div>

        {/* 한 줄 요약 */}
        <div className="adm-field adm-field--full">
          <label htmlFor="ann-summary">한 줄 요약</label>
          <input
            id="ann-summary"
            className="adm-input"
            value={form.summary}
            onChange={(e) => set("summary", e.target.value)}
            placeholder="목록과 배너에 표시되는 짧은 설명"
          />
        </div>

        {/* 본문 */}
        <div className="adm-field adm-field--full">
          <label htmlFor="ann-body">본문</label>
          <textarea
            id="ann-body"
            className="adm-textarea adm-ann-body"
            value={form.body_md}
            rows={18}
            onChange={(e) => set("body_md", e.target.value)}
            placeholder="마크다운으로 작성하세요"
          />
          <span className="adm-field-hint">
            마크다운 — ## 소제목, [링크](주소), 엔터 한 번 = 줄바꿈, 빈 줄 = 문단
          </span>
        </div>

        {/* 게시 여부 */}
        <div className="adm-field adm-field--full">
          <label style={{ flexDirection: "row", alignItems: "center", gap: "var(--adm-sp-2)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) => set("is_published", e.target.checked)}
            />
            게시 (체크 시 공개 페이지에 노출)
          </label>
        </div>
      </div>

      {clientError && (
        <div style={{ color: "var(--adm-danger)", fontSize: "var(--adm-fs-sm)" }}>{clientError}</div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--adm-sp-2)" }}>
        <button type="button" className="adm-btn" onClick={onCancel} disabled={busy}>
          취소
        </button>
        <button type="submit" className="adm-btn adm-btn--primary" disabled={busy}>
          {busy && <span className="adm-spin" />}
          {isNew ? "생성" : "저장"}
        </button>
      </div>
    </form>
  );
}

// ── 내부 구현 (ToastProvider 안쪽) ───────────────────────────────────────

function AnnouncementsManagerInner({
  initialAnnouncements,
}: {
  initialAnnouncements: AnnouncementRow[];
}) {
  const router = useRouter();
  const { toast, toastError } = useToast();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<AnnouncementRow | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AnnouncementRow | null>(null);
  const [busy, setBusy] = React.useState(false);

  // 생성
  async function handleCreate(input: AnnouncementInput) {
    setBusy(true);
    try {
      await createAnnouncementAction(input);
      toast(`공지 "${input.title}" 생성 완료`);
      setFormOpen(false);
      router.refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setBusy(false);
    }
  }

  // 수정
  async function handleUpdate(input: AnnouncementInput) {
    if (!editTarget) return;
    const { slug, ...rest } = input;
    setBusy(true);
    try {
      await updateAnnouncementAction(slug, rest);
      toast(`공지 "${input.title}" 저장 완료`);
      setEditTarget(null);
      router.refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setBusy(false);
    }
  }

  // 게시/비게시 토글
  async function handleTogglePublish(row: AnnouncementRow) {
    try {
      await updateAnnouncementAction(row.slug, { is_published: !row.is_published });
      toast(row.is_published ? "비공개로 전환했습니다." : "게시됐습니다.");
      router.refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "전환 실패");
    }
  }

  // 삭제
  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteAnnouncementAction(deleteTarget.slug);
      toast(`공지 "${deleteTarget.title}" 삭제 완료`);
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "삭제 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm-page">
      <header className="adm-page-head">
        <h1 className="adm-page-title">공지</h1>
        <span className="adm-page-sub">announcements</span>
        <div className="adm-page-head-actions">
          <button
            type="button"
            className="adm-btn adm-btn--primary"
            onClick={() => setFormOpen(true)}
          >
            새 공지
          </button>
        </div>
      </header>

      <div className="adm-page-body">
        {initialAnnouncements.length === 0 ? (
          <EmptyState title="공지가 없습니다" hint="새 공지 버튼으로 첫 공지를 작성하세요." />
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>제목</th>
                  <th style={{ width: 160 }}>slug</th>
                  <th style={{ width: 80 }}>상태</th>
                  <th style={{ width: 110 }}>게시일</th>
                  <th style={{ width: 150 }}>수정일</th>
                  <th style={{ width: 100 }} className="adm-cell-actions" />
                </tr>
              </thead>
              <tbody>
                {initialAnnouncements.map((row) => (
                  <tr
                    key={row.slug}
                    data-clickable="true"
                    onClick={() => setEditTarget(row)}
                  >
                    <td className="adm-cell-wrap">{row.title}</td>
                    <td className="adm-cell-mono">{row.slug}</td>
                    <td>
                      <span
                        className={`adm-badge${row.is_published ? " adm-badge--published" : " adm-badge--draft"}`}
                      >
                        {row.is_published ? "게시됨" : "비공개"}
                      </span>
                    </td>
                    <td className="adm-cell-mono">{formatAnnouncementDate(row.published_at)}</td>
                    <td className="adm-cell-mono">
                      {new Date(row.updated_at).toLocaleString("ko-KR", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td
                      className="adm-cell-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="adm-btn adm-btn--ghost adm-btn--sm"
                        onClick={() => handleTogglePublish(row)}
                        title={row.is_published ? "비공개로 전환" : "게시"}
                      >
                        {row.is_published ? "비공개" : "게시"}
                      </button>
                      <button
                        type="button"
                        className="adm-btn adm-btn--danger adm-btn--sm"
                        onClick={() => setDeleteTarget(row)}
                        title="삭제"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 생성 다이얼로그 */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="새 공지 작성"
        wide
      >
        <AnnouncementForm
          initial={emptyInput()}
          isNew
          onSubmit={handleCreate}
          onCancel={() => setFormOpen(false)}
          busy={busy}
        />
      </Dialog>

      {/* 수정 다이얼로그 */}
      <Dialog
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title="공지 수정"
        wide
      >
        {editTarget && (
          <AnnouncementForm
            initial={rowToInput(editTarget)}
            isNew={false}
            onSubmit={handleUpdate}
            onCancel={() => setEditTarget(null)}
            busy={busy}
          />
        )}
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="공지 삭제"
        description={
          deleteTarget
            ? `"${deleteTarget.title}" 공지를 삭제하면 복구할 수 없습니다. 계속하시겠습니까?`
            : ""
        }
        confirmLabel="삭제"
        busy={busy}
      />
    </div>
  );
}

// ── 공개 컴포넌트 (ToastProvider 래핑) ───────────────────────────────────

export default function AnnouncementsManager({
  initialAnnouncements,
}: {
  initialAnnouncements: AnnouncementRow[];
}) {
  return (
    <ToastProvider>
      <AnnouncementsManagerInner initialAnnouncements={initialAnnouncements} />
    </ToastProvider>
  );
}
