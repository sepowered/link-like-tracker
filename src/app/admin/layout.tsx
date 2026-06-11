import { redirect } from "next/navigation";
import { checkAdmin } from "@/lib/admin/require-admin";
import AdminShell from "./AdminShell";
import AdminForbiddenPage from "./forbidden/page";

/**
 * 백오피스 게이트 레이아웃 (서버 컴포넌트).
 *
 * - 미로그인 → OAuth 로그인 페이지(/auth/connect)로 리다이렉트.
 * - 로그인했지만 비관리자 → 403 화면을 인라인으로 렌더(셸 없이).
 * - 관리자 → AdminShell 안에서 children 렌더.
 *
 * 비관리자를 /admin/forbidden 으로 redirect 하지 않는 이유: 그 경로 역시
 * 이 레이아웃의 보호 아래에 있어 redirect가 무한 루프를 만든다. 대신 동일한
 * 403 화면을 인라인으로 렌더해 루프 없이 동일한 UX를 제공한다.
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

  return <AdminShell>{children}</AdminShell>;
}
