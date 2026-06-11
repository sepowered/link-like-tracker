"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import * as repo from "@/lib/admin/requests-repo";
import * as catalog from "@/lib/admin/catalog-repo";
import type { ListRequestsFilter, RequestRow, RequestStatus } from "@/lib/admin/requests-repo";
import type { CreateContentInput } from "@/lib/admin/catalog-repo";
import type { AdminContent } from "@/lib/admin/catalog-types";
import type { CategoryOverrideValue, ContentType } from "@/types";

/**
 * 요청 관리 서버 액션 — 백오피스 v2.
 *
 * 모든 액션은 첫 줄에서 requireAdmin()(throwing variant)을 호출한다.
 * v2 워크플로우의 핵심은 '처리(resolve)' 통합 액션 2개:
 *   - resolveEditRequestAction: 연결 콘텐츠 수정 → 요청 완료, 한 번에.
 *   - resolveAddRequestAction : 콘텐츠 생성 → 요청에 연결 + 완료, 한 번에.
 * 순서가 중요하다 — 카탈로그 쓰기가 '성공한 뒤에만' 요청 상태를 갱신한다.
 * 콘텐츠 쓰기 실패 시 요청은 그대로 남아 재시도 가능(반쪽 처리 없음).
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

export interface EditResolutionPatch {
  type?: ContentType;
  title_ko?: string | null;
  title_jp?: string | null;
  part_label?: string | null;
  category_override?: CategoryOverrideValue;
}

/**
 * edit 요청 처리: 연결된 콘텐츠에 패치를 반영하고 요청을 done으로 종결.
 * legacy_video_id는 패치 시그니처에서 원천 배제(불변 규칙).
 */
export async function resolveEditRequestAction(
  requestId: string,
  contentId: string,
  patch: EditResolutionPatch,
): Promise<{ request: RequestRow; content: AdminContent }> {
  const { email } = await requireAdmin();

  // 1) 카탈로그 반영이 먼저 — 실패하면 요청은 건드리지 않는다.
  const content = await catalog.updateContent(contentId, patch);

  // 2) 요청 종결 (+ 연결이 비어 있었으면 이번에 채운다)
  const request = await repo.resolveRequest(requestId, {
    status: "done",
    content_id: contentId,
  });

  console.log(`[admin:requests] ${email ?? "unknown"} resolveEdit ${requestId} -> content ${contentId}`);
  revalidatePath("/");
  revalidatePath("/admin/requests");
  revalidatePath("/admin/catalog");
  return { request, content };
}

export interface AddResolutionSource {
  url: string;
  label?: string | null;
  timestamp_todo?: boolean;
}

/**
 * add 요청 처리: 새 콘텐츠(+선택 소스)를 생성하고 요청에 연결한 뒤 done으로 종결.
 * 소스 생성 실패 시에도 콘텐츠는 이미 생성됐으므로 요청은 done으로 종결하되
 * 에러를 다시 던지지 않고 부분 성공을 반환 메시지로 알린다 — 가장 비싼 단계
 * (콘텐츠 생성)가 성공했는데 전체 실패로 보이면 중복 생성을 유발한다.
 */
export async function resolveAddRequestAction(
  requestId: string,
  contentInput: CreateContentInput,
  sources: AddResolutionSource[] = [],
): Promise<{ request: RequestRow; content: AdminContent; sourceErrors: string[] }> {
  const { email } = await requireAdmin();

  // 1) 콘텐츠 생성이 먼저 — 실패하면 요청은 건드리지 않는다.
  const content = await catalog.createContent(contentInput);

  // 2) 소스 생성(베스트 에포트 — 실패 항목은 수집해 보고)
  const sourceErrors: string[] = [];
  for (const source of sources) {
    try {
      await catalog.createContentSource({
        content_id: content.id,
        url: source.url,
        label: source.label ?? null,
        timestamp_todo: source.timestamp_todo ?? false,
      });
    } catch (err) {
      sourceErrors.push(err instanceof Error ? err.message : String(err));
    }
  }

  // 3) 요청 연결 + 종결
  const request = await repo.resolveRequest(requestId, {
    status: "done",
    content_id: content.id,
  });

  console.log(`[admin:requests] ${email ?? "unknown"} resolveAdd ${requestId} -> new content ${content.id}`);
  revalidatePath("/");
  revalidatePath("/admin/requests");
  revalidatePath("/admin/catalog");
  return { request, content, sourceErrors };
}
