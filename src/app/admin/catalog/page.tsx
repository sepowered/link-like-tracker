import { requireAdmin } from "@/lib/admin/require-admin";
import { getCatalogAdmin } from "@/lib/admin/catalog-repo";
import CatalogEditor from "./CatalogEditor";

/**
 * 카탈로그 편집기 페이지 — /admin/catalog
 *
 * 서버 컴포넌트: service_role로 전체 카탈로그 트리를 fetch해 CatalogEditor에 넘긴다.
 * force-dynamic으로 매 요청마다 최신 데이터를 보장한다.
 */
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  await requireAdmin();
  const seasons = await getCatalogAdmin();

  // ToastProvider는 admin/layout.tsx가 전역으로 제공한다 — 중복 래핑 금지.
  return <CatalogEditor initialSeasons={seasons} />;
}
