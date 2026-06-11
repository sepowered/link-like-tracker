/**
 * 요청 상태 상수/타입 — 클라이언트와 서버 양쪽에서 import 가능해야 하므로
 * `server-only`를 두지 않는다. requests-repo(server-only)는 여기서 재export한다.
 *
 * DB `requests.status`에는 CHECK 제약이 없어(REQUESTS_SCHEMA.md 참고) 검증은
 * 앱 레이어에서 이 목록으로 한다.
 */

export const REQUEST_STATUSES = ["pending", "approved", "rejected", "done"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type RequestType = "add" | "edit";

/** UI 라벨(한국어). */
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "대기",
  approved: "승인",
  rejected: "반려",
  done: "완료",
};

export function isValidRequestStatus(value: string): value is RequestStatus {
  return (REQUEST_STATUSES as readonly string[]).includes(value);
}
