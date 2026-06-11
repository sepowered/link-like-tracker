"use client";

/**
 * RequestsInbox — 요청 인박스 (마스터-디테일).
 *
 * v2 워크플로우: 요청을 '보는' 화면이 아니라 '처리하는' 화면.
 * 좌측 리스트에서 고르면 우측 패널에서 정보 확인 → 카탈로그 반영 → 종결까지
 * 화면 이동 없이 끝낸다. 처리 로직은 RequestDetail이 담당한다.
 */

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconMagnifyingglassLine } from "@karrotmarket/react-monochrome-icon";
import type { RequestRow } from "@/lib/admin/requests-types";
import {
  REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  type RequestStatus,
  type RequestType,
} from "@/lib/admin/request-status";
import type { CategoryOverrideValue, ContentType } from "@/types";
import { StatusBadge, EmptyState } from "../ui/primitives";
import { formatDate } from "../ui/labels";
import RequestDetail from "./RequestDetail";

export interface EpisodeOption {
  id: string;
  label: string;
}

export interface ContentOption {
  id: string;
  episode_id: string;
  episodeLabel: string;
  type: ContentType;
  title_ko: string | null;
  title_jp: string | null;
  part_label: string | null;
  legacy_video_id: string;
  category_override: CategoryOverrideValue;
}

type StatusTab = RequestStatus | "all";

export default function RequestsInbox({
  initialRequests,
  episodes,
  contents,
}: {
  initialRequests: RequestRow[];
  episodes: EpisodeOption[];
  contents: ContentOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [requests, setRequests] = React.useState<RequestRow[]>(initialRequests);
  const [statusTab, setStatusTab] = React.useState<StatusTab>("pending");
  const [typeFilter, setTypeFilter] = React.useState<"all" | RequestType>("all");
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(searchParams.get("id"));

  // 대시보드 등에서 ?id= 로 진입한 경우: 해당 요청의 상태 탭으로 자동 전환
  React.useEffect(() => {
    const id = searchParams.get("id");
    if (!id) return;
    const target = initialRequests.find((r) => r.id === id);
    if (target?.status && (REQUEST_STATUSES as readonly string[]).includes(target.status)) {
      setStatusTab(target.status as RequestStatus);
    }
    setSelectedId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 진입 시 1회만
  }, []);

  function select(id: string | null) {
    setSelectedId(id);
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("id", id);
    else params.delete("id");
    router.replace(`/admin/requests${params.size ? `?${params}` : ""}`, { scroll: false });
  }

  /** RequestDetail이 처리(상태 변경/반영) 결과를 돌려주면 로컬 리스트에 반영 */
  const applyUpdatedRow = React.useCallback((row: RequestRow) => {
    setRequests((prev) => prev.map((r) => (r.id === row.id ? row : r)));
  }, []);

  const counts = React.useMemo(() => {
    const c: Record<StatusTab, number> = { all: requests.length, pending: 0, approved: 0, rejected: 0, done: 0 };
    for (const r of requests) {
      if (r.status && r.status in c) c[r.status as RequestStatus]++;
    }
    return c;
  }, [requests]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusTab !== "all" && r.status !== statusTab) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (q) {
        const haystack = `${r.video_title ?? ""} ${r.description ?? ""} ${r.link ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [requests, statusTab, typeFilter, query]);

  const selected = requests.find((r) => r.id === selectedId) ?? null;

  const tabs: { value: StatusTab; label: string }[] = [
    { value: "pending", label: REQUEST_STATUS_LABELS.pending },
    { value: "approved", label: REQUEST_STATUS_LABELS.approved },
    { value: "rejected", label: REQUEST_STATUS_LABELS.rejected },
    { value: "done", label: REQUEST_STATUS_LABELS.done },
    { value: "all", label: "전체" },
  ];

  return (
    <div className="adm-page">
      <header className="adm-page-head">
        <h1 className="adm-page-title">요청</h1>
        <span className="adm-page-sub">{counts.pending > 0 ? `대기 ${counts.pending}건` : "모두 처리됨"}</span>
      </header>

      <div className="adm-page-body adm-page-body--flush">
        <div className="adm-split">
          {/* ── 좌측: 리스트 ─────────────────────────────────── */}
          <div className="adm-split-list">
            <div className="adm-toolbar">
              <div className="adm-tabs" role="tablist">
                {tabs.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    role="tab"
                    className="adm-tab"
                    data-active={statusTab === t.value}
                    onClick={() => setStatusTab(t.value)}
                  >
                    {t.label}
                    <span className="adm-tab-count">{counts[t.value]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="adm-toolbar">
              <div className="adm-search" style={{ flex: 1 }}>
                <IconMagnifyingglassLine />
                <input
                  className="adm-input"
                  placeholder="제목·설명·링크 검색"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <select
                className="adm-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as "all" | RequestType)}
                aria-label="유형 필터"
              >
                <option value="all">모든 유형</option>
                <option value="add">{REQUEST_TYPE_LABELS.add}</option>
                <option value="edit">{REQUEST_TYPE_LABELS.edit}</option>
              </select>
            </div>

            <div className="adm-table-wrap" style={{ flex: 1 }}>
              {filtered.length === 0 ? (
                <EmptyState
                  title={statusTab === "pending" ? "대기 중인 요청이 없어요" : "표시할 요청이 없어요"}
                  hint="필터를 바꾸면 다른 요청을 볼 수 있어요."
                />
              ) : (
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th style={{ width: 56 }}>유형</th>
                      <th>제목</th>
                      <th style={{ width: 84 }}>상태</th>
                      <th style={{ width: 72 }}>접수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr
                        key={r.id}
                        data-clickable="true"
                        data-selected={r.id === selectedId}
                        onClick={() => select(r.id)}
                      >
                        <td>
                          <span className="adm-badge adm-badge--plain">
                            {REQUEST_TYPE_LABELS[r.type as RequestType] ?? r.type}
                          </span>
                        </td>
                        <td className="adm-cell-wrap" style={{ fontWeight: 600 }}>
                          {r.video_title || <span className="adm-muted">(제목 없음)</span>}
                        </td>
                        <td><StatusBadge status={r.status} /></td>
                        <td className="adm-cell-mono">{formatDate(r.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ── 우측: 상세/처리 패널 ─────────────────────────── */}
          {selected ? (
            <div className="adm-split-detail" key={selected.id}>
              <RequestDetail
                request={selected}
                episodes={episodes}
                contents={contents}
                onUpdated={applyUpdatedRow}
              />
            </div>
          ) : (
            <div className="adm-split-detail">
              <EmptyState
                title="요청을 선택하세요"
                hint="왼쪽 목록에서 요청을 고르면 여기서 바로 처리할 수 있어요."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
