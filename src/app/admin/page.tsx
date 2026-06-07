import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/require-admin";

/**
 * 백오피스 랜딩 — /admin
 *
 * 대시보드를 걷어내고 데이터-툴 첫 화면(요청 관리)으로 곧장 보낸다.
 * 레이아웃 게이트가 이미 관리자만 통과시키지만, 데이터 접근 전에
 * requireAdmin()으로 한 번 더 확인한 뒤 리다이렉트한다.
 */
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  redirect("/admin/requests");
}
