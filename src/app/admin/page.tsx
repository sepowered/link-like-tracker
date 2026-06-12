import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { countRequestsByStatus, listRequests } from "@/lib/admin/requests-repo";
import { getCatalogAdmin } from "@/lib/admin/catalog-repo";
import { StatusBadge } from "./ui/primitives";
import { REQUEST_TYPE_LABELS, type RequestType } from "@/lib/admin/request-status";

export const dynamic = "force-dynamic";

/**
 * /admin — 대시보드 (서버 컴포넌트, 백오피스 v2).
 *
 * 운영자가 들어와서 3초 안에 알아야 할 것:
 * 1) 처리할 요청이 몇 건인가 (가장 크게, 경고 테두리)
 * 2) 카탈로그 규모와 품질 신호 (소스 없는 콘텐츠, 타임스탬프 TODO)
 * 3) 바로 처리하러 갈 수 있는 최근 대기 요청 목록
 */
export default async function AdminDashboardPage() {
  await requireAdmin();

  const [counts, catalog, pending] = await Promise.all([
    countRequestsByStatus(),
    getCatalogAdmin(),
    listRequests({ status: "pending" }),
  ]);

  const contents = catalog.flatMap((s) => s.episodes.flatMap((e) => e.contents));
  const sources = contents.flatMap((c) => c.content_sources);
  const stats = {
    seasons: catalog.length,
    episodes: catalog.reduce((n, s) => n + s.episodes.length, 0),
    contents: contents.length,
    sources: sources.length,
    noSource: contents.filter((c) => c.content_sources.length === 0 && c.type !== "unavailable").length,
    timestampTodo: sources.filter((s) => s.timestamp_todo).length,
  };

  const recentPending = pending.slice(0, 6);

  return (
    <div className="adm-page">
      <header className="adm-page-head">
        <h1 className="adm-page-title">대시보드</h1>
        <span className="adm-page-sub">requests · catalog</span>
      </header>

      <div className="adm-page-body" style={{ display: "flex", flexDirection: "column", gap: "var(--adm-sp-5)" }}>
        {/* 처리 대기 — 가장 중요한 숫자 */}
        <section className="adm-grid adm-grid--stats">
          <Link
            href="/admin/requests"
            className={`adm-card adm-card--link${counts.pending > 0 ? " adm-card--alert" : ""}`}
          >
            <h2 className="adm-card-title">대기 요청</h2>
            <div className="adm-stat">{counts.pending}</div>
            <div className="adm-stat-sub">
              승인 {counts.approved} · 반려 {counts.rejected} · 완료 {counts.done}
            </div>
          </Link>
          <Link href="/admin/catalog" className="adm-card adm-card--link">
            <h2 className="adm-card-title">콘텐츠</h2>
            <div className="adm-stat">{stats.contents}</div>
            <div className="adm-stat-sub">
              시즌 {stats.seasons} · 에피소드 {stats.episodes} · 소스 {stats.sources}
            </div>
          </Link>
          <div className="adm-card">
            <h2 className="adm-card-title">소스 없는 콘텐츠</h2>
            <div className="adm-stat">{stats.noSource}</div>
            <div className="adm-stat-sub">비공개(unavailable) 제외</div>
          </div>
          <div className="adm-card">
            <h2 className="adm-card-title">타임스탬프 TODO</h2>
            <div className="adm-stat">{stats.timestampTodo}</div>
            <div className="adm-stat-sub">시작 시각 미기입 소스</div>
          </div>
        </section>

        {/* 최근 대기 요청 — 바로 처리하러 가기 */}
        <section>
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--adm-sp-2)", marginBottom: "var(--adm-sp-2)" }}>
            <h2 style={{ fontSize: "var(--adm-fs-md)", fontWeight: 700, margin: 0 }}>최근 대기 요청</h2>
            <Link href="/admin/requests" className="adm-link" style={{ fontSize: "var(--adm-fs-sm)" }}>
              전체 보기 →
            </Link>
          </div>
          {recentPending.length === 0 ? (
            <div className="adm-card">
              <div className="adm-empty" style={{ padding: "var(--adm-sp-5)" }}>
                <strong>처리할 요청이 없어요</strong>
                <span>새 요청이 들어오면 여기에 표시돼요.</span>
              </div>
            </div>
          ) : (
            <div className="adm-card" style={{ padding: 0, overflow: "hidden" }}>
              <table className="adm-table">
                <thead>
                  <tr>
                    <th style={{ width: 64 }}>유형</th>
                    <th>제목</th>
                    <th style={{ width: 96 }}>상태</th>
                    <th style={{ width: 110 }}>접수일</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPending.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className="adm-badge adm-badge--plain">
                          {REQUEST_TYPE_LABELS[r.type as RequestType] ?? r.type}
                        </span>
                      </td>
                      <td className="adm-cell-wrap">
                        <Link href={`/admin/requests?id=${r.id}`} className="adm-link">
                          {r.video_title || "(제목 없음)"}
                        </Link>
                      </td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="adm-cell-mono">
                        {new Date(r.created_at).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
