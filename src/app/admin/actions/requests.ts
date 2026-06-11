"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import * as repo from "@/lib/admin/requests-repo";
import type { ListRequestsFilter, RequestRow, RequestStatus } from "@/lib/admin/requests-repo";

/**
 * 요청 관리 서버 액션.
 *
 * 모든 액션은 첫 줄에서 requireAdmin()(throwing variant)을 호출해 관리자임을
 * 확인한다. 상태 변경 후 '/admin/requests'를 revalidate 하고 actor 이메일 +
 * request id를 로그로 남긴다. status 외에는 수정하지 않는다(카탈로그 자동 승격 없음).
 */

export async function listRequestsAction(filter: ListRequestsFilter = {}): Promise<RequestRow[]> {
  await requireAdmin();
  return repo.listRequests(filter);
}

export async function getRequestAction(id: string): Promise<RequestRow | null> {
  await requireAdmin();
  return repo.getRequest(id);
}

export async function updateRequestStatusAction(
  id: string,
  status: RequestStatus,
): Promise<RequestRow> {
  const { email } = await requireAdmin();
  const row = await repo.updateRequestStatus(id, status);
  console.log(`[admin:requests] ${email ?? "unknown"} updateStatus ${id} -> ${status}`);
  revalidatePath("/admin/requests");
  return row;
}
