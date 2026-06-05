import { listRequestsAction } from "@/app/admin/actions/requests";
import RequestsClient from "./RequestsClient";

/**
 * 요청 관리 페이지 — /admin/requests
 *
 * 서버 컴포넌트: 초기 요청 목록을 fetch해 RequestsClient에 props로 전달한다.
 * 필터링·상태 변경은 클라이언트에서 처리한다.
 */
export default async function RequestsPage() {
  const rows = await listRequestsAction();

  return (
    <div style={{ maxWidth: "1100px" }}>
      <h1
        style={{
          fontSize: "20px",
          fontWeight: 700,
          color: "var(--seed-color-fg-neutral)",
          marginBottom: "4px",
          letterSpacing: "-0.02em",
        }}
      >
        요청 관리
      </h1>
      <p
        style={{
          fontSize: "13px",
          color: "var(--seed-color-fg-neutral-subtle)",
          marginBottom: "24px",
        }}
      >
        총 {rows.length}건의 요청이 있습니다.
      </p>

      <RequestsClient initialRows={rows} />
    </div>
  );
}
