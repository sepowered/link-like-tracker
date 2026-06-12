import { redirect } from "next/navigation";
import { checkAdmin } from "@/lib/admin/require-admin";
import { countRequestsByStatus } from "@/lib/admin/requests-repo";
import AdminShell from "./AdminShell";
import AdminForbiddenPage from "./forbidden/page";
import { ToastProvider } from "./ui/primitives";
import "./admin.css";

/**
 * 백오피스 게이트 레이아웃 (서버 컴포넌트).
 *
 * - 미로그인 → OAuth 로그인 페이지(/auth/connect)로 리다이렉트.
 * - 로그인했지만 비관리자 → 403 화면을 인라인으로 렌더(셸 없이).
 *   (/admin/forbidden 으로 redirect 하면 그 경로도 이 레이아웃의 보호 아래라
 *    무한 루프가 난다 — 인라인 렌더가 의도된 방식.)
 * - 관리자 → AdminShell(v2) 안에서 children 렌더. 내비의 대기 요청 카운트는
 *   revalidatePath("/admin/...") 시 함께 갱신된다.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await checkAdmin();

  if (!result.ok) {
    if (result.reason === "unauthenticated") {
      redirect("/auth/connect");
    }
    return <AdminForbiddenPage />;
  }

  let pendingCount: number | undefined;
  try {
    pendingCount = (await countRequestsByStatus()).pending;
  } catch {
    pendingCount = undefined; // 카운트 실패가 백오피스 진입을 막으면 안 된다
  }

  return (
    <ToastProvider>
      <AdminShell pendingCount={pendingCount}>{children}</AdminShell>
    </ToastProvider>
  );
}
