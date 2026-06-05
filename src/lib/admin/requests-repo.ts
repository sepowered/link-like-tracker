import "server-only";

import { getAdminClient } from "./admin-client";
import {
  REQUEST_STATUSES,
  isValidRequestStatus,
  type RequestStatus,
  type RequestType,
} from "./request-status";
import type { RequestRow } from "./requests-types";

// 단일 출처 재export — 클라이언트는 ./request-status 또는 ./requests-types에서 직접 가져올 수 있다.
export { REQUEST_STATUSES, isValidRequestStatus };
export type { RequestStatus, RequestType, RequestRow };

/**
 * `requests` 테이블 읽기/상태관리 레포지토리 (service_role).
 *
 * 이 테이블은 프로덕션에 이미 존재하며 repo 마이그레이션에 없다. 절대 재생성하지
 * 않는다. 백오피스는 status만 관리한다. 스키마 실측은 REQUESTS_SCHEMA.md 참고.
 *
 * `import "server-only";` 이므로 클라이언트 번들에 포함될 수 없다. 호출부(서버
 * 액션)는 반드시 requireAdmin()으로 권한을 먼저 확인해야 한다.
 * 타입은 ./requests-types (순수 타입 모듈)에 정의되어 클라이언트에서도 안전하게 사용 가능.
 */

const COLUMNS = "id, created_at, type, video_title, link, request_type, category, generation, description, status";

export interface ListRequestsFilter {
  status?: RequestStatus;
  type?: RequestType;
}

/**
 * 요청 목록. created_at desc 정렬을 우선 시도하고, 해당 컬럼이 없는 환경 등에서
 * 실패하면 id 정렬로 폴백한다(방어적).
 */
export async function listRequests(filter: ListRequestsFilter = {}): Promise<RequestRow[]> {
  const supabase = getAdminClient();

  // 필터는 정렬보다 먼저 적용한다. 같은 필터를 두 정렬 시도에 재사용하기 위해
  // 빌더 구성을 함수로 분리한다.
  function filtered() {
    let query = supabase.from("requests").select(COLUMNS);
    if (filter.status) query = query.eq("status", filter.status);
    if (filter.type) query = query.eq("type", filter.type);
    return query;
  }

  const primary = await filtered()
    .order("created_at", { ascending: false })
    .returns<RequestRow[]>();

  if (!primary.error) {
    return primary.data ?? [];
  }

  // created_at 정렬 실패 시 id 정렬로 폴백(방어적)
  const fallback = await filtered().order("id", { ascending: false }).returns<RequestRow[]>();

  if (fallback.error) throw new Error(`[requests-repo:listRequests] ${fallback.error.message}`);
  return fallback.data ?? [];
}

export async function getRequest(id: string): Promise<RequestRow | null> {
  const { data, error } = await getAdminClient()
    .from("requests")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle<RequestRow>();

  if (error) throw new Error(`[requests-repo:getRequest] ${error.message}`);
  return data;
}

export async function updateRequestStatus(id: string, status: RequestStatus): Promise<RequestRow> {
  if (!isValidRequestStatus(status)) {
    throw new Error(`[requests-repo:updateRequestStatus] invalid status "${status}"`);
  }

  const { data, error } = await getAdminClient()
    .from("requests")
    .update({ status })
    .eq("id", id)
    .select(COLUMNS)
    .single<RequestRow>();

  if (error) throw new Error(`[requests-repo:updateRequestStatus] ${error.message}`);
  return data;
}
