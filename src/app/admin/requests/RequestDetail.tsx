"use client";

/**
 * RequestDetail — 요청 상세 + 그 자리에서 처리(resolve).
 *
 * - edit 요청: 연결 콘텐츠(없으면 검색해서 연결) 편집 폼 → [반영하고 완료].
 * - add  요청: 요청 내용이 프리필된 콘텐츠 생성 폼 → [생성하고 완료].
 * - 그 외 전이는 PRIMARY_TRANSITIONS 버튼 + 보조 상태 변경 메뉴.
 *
 * 처리 액션은 서버에서 카탈로그 쓰기 성공 후에만 요청을 종결하므로,
 * 실패 시 요청은 그대로 남는다(반쪽 처리 없음) — UI는 에러 토스트만 띄운다.
 */

import * as React from "react";
import { safeHttpHref } from "@/lib/safe-url";
import type { RequestRow } from "@/lib/admin/requests-types";
import {
  PRIMARY_TRANSITIONS,
  REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  type RequestStatus,
  type RequestType,
} from "@/lib/admin/request-status";
import type { CategoryOverrideValue, ContentType } from "@/types";
import {
  resolveAddRequestAction,
  resolveEditRequestAction,
  updateRequestStatusAction,
} from "@/app/admin/actions/requests";
import { StatusBadge, useToast } from "../ui/primitives";
import {
  CATEGORY_OVERRIDE_OPTIONS,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_OPTIONS,
  formatDateTime,
} from "../ui/labels";
import type { ContentOption, EpisodeOption } from "./RequestsInbox";

// ── 유틸 ─────────────────────────────────────────────────────────────────

/** 요청 링크에서 YouTube 영상 id 추출(프리필용). 실패하면 null. */
function extractYoutubeId(link: string | null): string | null {
  if (!link) return null;
  try {
    const url = new URL(link);
    if (url.hostname === "youtu.be") return url.pathname.slice(1) || null;
    if (url.hostname.endsWith("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return v;
      const shorts = url.pathname.match(/^\/(?:shorts|live)\/([^/]+)/);
      if (shorts) return shorts[1];
    }
  } catch {
    return null;
  }
  return null;
}

function toOverride(value: string): CategoryOverrideValue {
  return value === "" ? null : (value as CategoryOverrideValue);
}

// ── 본체 ─────────────────────────────────────────────────────────────────

export default function RequestDetail({
  request,
  episodes,
  contents,
  onUpdated,
}: {
  request: RequestRow;
  episodes: EpisodeOption[];
  contents: ContentOption[];
  onUpdated: (row: RequestRow) => void;
}) {
  const { toast, toastError } = useToast();
  const [busy, setBusy] = React.useState(false);

  const status = (REQUEST_STATUSES as readonly string[]).includes(request.status ?? "")
    ? (request.status as RequestStatus)
    : "pending";
  const isClosed = status === "done";
  const href = safeHttpHref(request.link);

  async function changeStatus(next: RequestStatus) {
    setBusy(true);
    try {
      const row = await updateRequestStatusAction(request.id, next);
      onUpdated(row);
      toast(`상태를 '${REQUEST_STATUS_LABELS[next]}'(으)로 바꿨어요.`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "상태 변경에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* ── 요청 정보 ──────────────────────────────────────── */}
      <section className="adm-detail-section">
        <h2 className="adm-detail-title">
          요청 정보
          <StatusBadge status={request.status} />
          <span className="adm-badge adm-badge--plain">
            {REQUEST_TYPE_LABELS[request.type as RequestType] ?? request.type}
          </span>
        </h2>
        <dl className="adm-kv">
          <dt>접수</dt>
          <dd className="adm-mono">{formatDateTime(request.created_at)}</dd>
          <dt>제목</dt>
          <dd style={{ fontWeight: 600 }}>{request.video_title || <span className="adm-muted">—</span>}</dd>
          <dt>링크</dt>
          <dd>
            {href ? (
              <a className="adm-link adm-mono" href={href} target="_blank" rel="noreferrer">
                {request.link}
              </a>
            ) : (
              <span className="adm-mono adm-muted">{request.link || "—"}</span>
            )}
          </dd>
          {request.request_type && (
            <>
              <dt>요청 종류</dt>
              <dd>{request.request_type}</dd>
            </>
          )}
          {request.category && (
            <>
              <dt>카테고리</dt>
              <dd>{request.category}</dd>
            </>
          )}
          {request.generation && (
            <>
              <dt>기수</dt>
              <dd>{request.generation}</dd>
            </>
          )}
          {request.description && (
            <>
              <dt>설명</dt>
              <dd style={{ whiteSpace: "pre-wrap" }}>{request.description}</dd>
            </>
          )}
          <dt>요청 ID</dt>
          <dd className="adm-mono adm-muted">{request.id}</dd>
        </dl>
      </section>

      {/* ── 처리 ───────────────────────────────────────────── */}
      {!isClosed && request.type === "edit" && (
        <EditResolveSection
          request={request}
          contents={contents}
          busy={busy}
          setBusy={setBusy}
          onUpdated={onUpdated}
        />
      )}
      {!isClosed && request.type === "add" && (
        <AddResolveSection
          request={request}
          episodes={episodes}
          contents={contents}
          busy={busy}
          setBusy={setBusy}
          onUpdated={onUpdated}
        />
      )}
      {isClosed && (
        <section className="adm-detail-section">
          <h2 className="adm-detail-title">처리 완료</h2>
          <p style={{ margin: 0 }} className="adm-muted">
            이 요청은 종결됐어요.
            {request.content_id && (
              <>
                {" "}연결 콘텐츠: <span className="adm-mono">{request.content_id}</span>
              </>
            )}
          </p>
        </section>
      )}

      {/* ── 상태 변경 ──────────────────────────────────────── */}
      <section className="adm-detail-section">
        <h2 className="adm-detail-title">상태</h2>
        <div style={{ display: "flex", gap: "var(--adm-sp-2)", flexWrap: "wrap", alignItems: "center" }}>
          {PRIMARY_TRANSITIONS[status].map((next) => (
            <button
              key={next}
              type="button"
              className={`adm-btn${next === "rejected" ? " adm-btn--danger" : ""}`}
              disabled={busy}
              onClick={() => changeStatus(next)}
            >
              {REQUEST_STATUS_LABELS[next]}(으)로
            </button>
          ))}
          <span className="adm-spacer" />
          <label className="adm-muted" style={{ fontSize: "var(--adm-fs-xs)" }}>
            직접 변경
          </label>
          <select
            className="adm-select"
            value={status}
            disabled={busy}
            onChange={(e) => changeStatus(e.target.value as RequestStatus)}
            aria-label="상태 직접 변경"
          >
            {REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {REQUEST_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </section>
    </div>
  );
}

// ── edit 요청 처리 섹션 ──────────────────────────────────────────────────

function EditResolveSection({
  request,
  contents,
  busy,
  setBusy,
  onUpdated,
}: {
  request: RequestRow;
  contents: ContentOption[];
  busy: boolean;
  setBusy: (b: boolean) => void;
  onUpdated: (row: RequestRow) => void;
}) {
  const { toast, toastError } = useToast();
  const linked = contents.find((c) => c.id === request.content_id) ?? null;
  const [picked, setPicked] = React.useState<ContentOption | null>(linked);
  const [search, setSearch] = React.useState("");

  const target = picked;

  // 폼 상태 — 대상 콘텐츠가 정해지면 그 값으로 초기화
  const [form, setForm] = React.useState(() => initForm(target));
  React.useEffect(() => {
    setForm(initForm(target));
  }, [target]);

  function initForm(c: ContentOption | null) {
    return {
      type: (c?.type ?? "story") as ContentType,
      title_ko: c?.title_ko ?? "",
      title_jp: c?.title_jp ?? "",
      part_label: c?.part_label ?? "",
      category_override: (c?.category_override ?? "") as string,
    };
  }

  const candidates = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return contents
      .filter((c) =>
        `${c.id} ${c.title_ko ?? ""} ${c.title_jp ?? ""} ${c.legacy_video_id}`.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [contents, search]);

  async function resolve() {
    if (!target) return;
    setBusy(true);
    try {
      const { request: row } = await resolveEditRequestAction(request.id, target.id, {
        type: form.type,
        title_ko: form.title_ko.trim() === "" ? null : form.title_ko.trim(),
        title_jp: form.title_jp.trim() === "" ? null : form.title_jp.trim(),
        part_label: form.part_label.trim() === "" ? null : form.part_label.trim(),
        category_override: toOverride(form.category_override),
      });
      onUpdated(row);
      toast("콘텐츠에 반영하고 요청을 완료했어요.");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "반영에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="adm-detail-section">
      <h2 className="adm-detail-title">수정 반영</h2>

      {!target && (
        <div className="adm-field">
          <label>대상 콘텐츠 찾기</label>
          <input
            className="adm-input"
            placeholder="제목·ID·legacy ID로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {candidates.length > 0 && (
            <div style={{ border: "1px solid var(--adm-stroke)", borderRadius: "var(--adm-radius)", overflow: "hidden" }}>
              {candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="adm-btn adm-btn--ghost"
                  style={{ width: "100%", justifyContent: "flex-start", borderRadius: 0, height: 32 }}
                  onClick={() => setPicked(c)}
                >
                  <span className="adm-badge adm-badge--plain">{CONTENT_TYPE_LABELS[c.type]}</span>
                  {c.title_ko || c.title_jp || c.id}
                  <span className="adm-muted" style={{ marginLeft: "auto", fontSize: "var(--adm-fs-xs)" }}>
                    {c.episodeLabel}
                  </span>
                </button>
              ))}
            </div>
          )}
          <span className="adm-field-hint">
            이 요청은 아직 콘텐츠와 연결돼 있지 않아요. 반영할 대상을 먼저 선택하세요.
          </span>
        </div>
      )}

      {target && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--adm-sp-3)" }}>
          <dl className="adm-kv">
            <dt>대상</dt>
            <dd>
              <span className="adm-mono">{target.id}</span>
              <span className="adm-muted"> · {target.episodeLabel}</span>
              {!linked && (
                <button
                  type="button"
                  className="adm-btn adm-btn--ghost adm-btn--sm"
                  style={{ marginLeft: 8 }}
                  onClick={() => setPicked(null)}
                >
                  다시 선택
                </button>
              )}
            </dd>
            <dt>legacy ID</dt>
            <dd className="adm-mono adm-muted">{target.legacy_video_id} (수정 불가)</dd>
          </dl>

          <div className="adm-form-grid">
            <div className="adm-field">
              <label>타입</label>
              <select
                className="adm-select"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ContentType }))}
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
                value={form.category_override}
                onChange={(e) => setForm((f) => ({ ...f, category_override: e.target.value }))}
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
                value={form.title_ko}
                onChange={(e) => setForm((f) => ({ ...f, title_ko: e.target.value }))}
              />
            </div>
            <div className="adm-field">
              <label>제목 (일본어)</label>
              <input
                className="adm-input"
                value={form.title_jp}
                onChange={(e) => setForm((f) => ({ ...f, title_jp: e.target.value }))}
              />
            </div>
            <div className="adm-field">
              <label>파트 라벨</label>
              <input
                className="adm-input adm-input--mono"
                value={form.part_label}
                onChange={(e) => setForm((f) => ({ ...f, part_label: e.target.value }))}
                placeholder="예: Part 1"
              />
            </div>
          </div>

          <div>
            <button type="button" className="adm-btn adm-btn--primary" disabled={busy} onClick={resolve}>
              {busy && <span className="adm-spin" />}
              반영하고 완료
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ── add 요청 처리 섹션 ───────────────────────────────────────────────────

function AddResolveSection({
  request,
  episodes,
  contents,
  busy,
  setBusy,
  onUpdated,
}: {
  request: RequestRow;
  episodes: EpisodeOption[];
  contents: ContentOption[];
  busy: boolean;
  setBusy: (b: boolean) => void;
  onUpdated: (row: RequestRow) => void;
}) {
  const { toast, toastError } = useToast();
  const ytId = extractYoutubeId(request.link);

  const [form, setForm] = React.useState({
    episode_id: episodes[0]?.id ?? "",
    id: ytId ?? "",
    legacy_video_id: ytId ?? "",
    type: "story" as ContentType,
    title_ko: request.video_title ?? "",
    title_jp: "",
    part_label: "",
    category_override: "",
    source_url: safeHttpHref(request.link) ?? "",
  });

  const idTaken = form.id !== "" && contents.some((c) => c.id === form.id);
  const canSubmit =
    !busy && form.episode_id !== "" && form.id.trim() !== "" && form.legacy_video_id.trim() !== "" && !idTaken;

  async function resolve() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const { request: row, sourceErrors } = await resolveAddRequestAction(
        request.id,
        {
          id: form.id.trim(),
          episode_id: form.episode_id,
          type: form.type,
          title_ko: form.title_ko.trim() === "" ? null : form.title_ko.trim(),
          title_jp: form.title_jp.trim() === "" ? null : form.title_jp.trim(),
          part_label: form.part_label.trim() === "" ? null : form.part_label.trim(),
          legacy_video_id: form.legacy_video_id.trim(),
          category_override: toOverride(form.category_override),
        },
        form.source_url.trim() !== "" ? [{ url: form.source_url.trim() }] : [],
      );
      onUpdated(row);
      if (sourceErrors.length > 0) {
        toastError(`콘텐츠는 생성됐지만 소스 추가에 실패했어요: ${sourceErrors[0]}`);
      } else {
        toast("콘텐츠를 생성하고 요청을 완료했어요.");
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : "생성에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="adm-detail-section">
      <h2 className="adm-detail-title">카탈로그에 추가</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--adm-sp-3)" }}>
        <div className="adm-form-grid">
          <div className="adm-field adm-field--full">
            <label>소속 에피소드</label>
            <select
              className="adm-select"
              value={form.episode_id}
              onChange={(e) => setForm((f) => ({ ...f, episode_id: e.target.value }))}
            >
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>{ep.label}</option>
              ))}
            </select>
          </div>
          <div className="adm-field">
            <label>콘텐츠 ID</label>
            <input
              className="adm-input adm-input--mono"
              value={form.id}
              onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
              placeholder="예: dQw4w9WgXcQ"
            />
            {idTaken && <span className="adm-field-hint" style={{ color: "var(--adm-danger)" }}>이미 존재하는 ID예요.</span>}
          </div>
          <div className="adm-field">
            <label>legacy 영상 ID</label>
            <input
              className="adm-input adm-input--mono"
              value={form.legacy_video_id}
              onChange={(e) => setForm((f) => ({ ...f, legacy_video_id: e.target.value }))}
            />
            <span className="adm-field-hint">생성 후에는 바꿀 수 없어요(시청 기록 연결 키).</span>
          </div>
          <div className="adm-field">
            <label>타입</label>
            <select
              className="adm-select"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ContentType }))}
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
              value={form.category_override}
              onChange={(e) => setForm((f) => ({ ...f, category_override: e.target.value }))}
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
              value={form.title_ko}
              onChange={(e) => setForm((f) => ({ ...f, title_ko: e.target.value }))}
            />
          </div>
          <div className="adm-field">
            <label>제목 (일본어)</label>
            <input
              className="adm-input"
              value={form.title_jp}
              onChange={(e) => setForm((f) => ({ ...f, title_jp: e.target.value }))}
            />
          </div>
          <div className="adm-field">
            <label>파트 라벨</label>
            <input
              className="adm-input adm-input--mono"
              value={form.part_label}
              onChange={(e) => setForm((f) => ({ ...f, part_label: e.target.value }))}
            />
          </div>
          <div className="adm-field adm-field--full">
            <label>소스 URL (함께 생성)</label>
            <input
              className="adm-input adm-input--mono"
              value={form.source_url}
              onChange={(e) => setForm((f) => ({ ...f, source_url: e.target.value }))}
              placeholder="https://…  (비우면 소스 없이 생성)"
            />
          </div>
        </div>

        <div>
          <button type="button" className="adm-btn adm-btn--primary" disabled={!canSubmit} onClick={resolve}>
            {busy && <span className="adm-spin" />}
            생성하고 완료
          </button>
        </div>
      </div>
    </section>
  );
}
