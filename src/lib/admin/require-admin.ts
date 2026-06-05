import "server-only";

import type { User } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAdminClient } from "./admin-client";

export type AdminCheckResult =
  | { ok: true; user: User; email: string | null }
  | { ok: false; reason: "unauthenticated" }
  | { ok: false; reason: "not-admin"; user: User };

/**
 * 현재 세션 사용자가 관리자(admin_users 멤버)인지 확인한다.
 *
 * 1) @supabase/ssr 쿠키 기반 서버 클라이언트로 로그인 사용자를 읽는다.
 * 2) 미로그인 → { ok: false, reason: "unauthenticated" }.
 * 3) admin_users 멤버십을 service_role 클라이언트로 user_id 기준 조회.
 *    (admin_users는 RLS상 본인 행만 SELECT 가능하지만, 레이어 일관성과
 *     향후 정책 변경에 견고하도록 service_role로 조회한다.)
 * 4) 멤버면 { ok: true, user, email }, 아니면 { ok: false, reason: "not-admin" }.
 *
 * 던지지 않는 변형이므로 레이아웃/페이지에서 분기/리다이렉트에 쓰기 좋다.
 */
export async function checkAdmin(): Promise<AdminCheckResult> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, reason: "unauthenticated" };
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("admin_users")
    .select("user_id, email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, reason: "not-admin", user };
  }

  return { ok: true, user, email: data.email ?? user.email ?? null };
}

/**
 * 던지는 변형 — 모든 관리자 서버 액션은 이 함수를 **첫 줄에서** 호출해야 한다.
 *
 * 미로그인 또는 비관리자면 Error를 던져 액션 실행을 즉시 중단한다.
 * 성공 시 { user, email }을 반환한다.
 *
 * 사용 예:
 *   "use server";
 *   export async function deleteContent(id: string) {
 *     await requireAdmin();           // ← 반드시 첫 줄
 *     // ... service_role 쓰기 ...
 *   }
 */
export async function requireAdmin(): Promise<{ user: User; email: string | null }> {
  const result = await checkAdmin();
  if (!result.ok) {
    throw new Error(
      result.reason === "unauthenticated"
        ? "Unauthorized: 로그인이 필요합니다."
        : "Forbidden: 관리자 권한이 필요합니다.",
    );
  }
  return { user: result.user, email: result.email };
}
