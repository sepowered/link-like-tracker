/**
 * 요청 상태 도메인 — 백오피스 v2.
 *
 * 클라이언트와 서버 양쪽에서 import 가능해야 하므로 `server-only`를 두지 않는다.
 *
 * DB에는 CHECK(pending/approved/rejected/done)만 있고 전이 제약은 없다(007a).
 * 전이 규칙은 앱 레이어인 여기 한 곳에 정의한다:
 * - PRIMARY_TRANSITIONS: 인박스 UI가 "다음 행동" 버튼으로 보여주는 권장 전이.
 * - 그 외 전이도 보조 메뉴로는 허용한다(1인 운영 도구 — 하드블록은 실수 복구를
 *   막아 더 위험). 유효성 검증은 enum 멤버십만 강제한다.
 */

export const REQUEST_STATUSES = ["pending", "approved", "rejected", "done"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type RequestType = "add" | "edit";

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "대기",
  approved: "승인",
  rejected: "반려",
  done: "완료",
};

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  add: "추가",
  edit: "수정",
};

/** 인박스의 권장 다음 행동. done은 종결 상태(재오픈은 보조 메뉴로). */
export const PRIMARY_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  pending: ["approved", "rejected"],
  approved: ["done", "rejected"],
  rejected: ["pending"],
  done: [],
};

export function isValidRequestStatus(value: string): value is RequestStatus {
  return (REQUEST_STATUSES as readonly string[]).includes(value);
}
