import { listRequestsAction } from "@/app/admin/actions/requests";
import RequestsClient from "./RequestsClient";

/**
 * 요청 관리 페이지 — /admin/requests
 *
 * 서버 컴포넌트: 초기 요청 목록을 fetch해 RequestsClient에 props로 전달한다.
 * 필터링·상태 변경·DataPageShell 렌더는 클라이언트(RequestsClient)에서 처리한다.
 */
export default async function RequestsPage() {
  const rows = await listRequestsAction();

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <RequestsClient initialRows={rows} />
    </div>
  );
}
