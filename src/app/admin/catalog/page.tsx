import { requireAdmin } from "@/lib/admin/require-admin";
import { getCatalogAdmin } from "@/lib/admin/catalog-repo";
import CatalogClient from "./CatalogClient";

/**
 * 카탈로그 관리 페이지 — /admin/catalog
 *
 * 서버 컴포넌트: service_role로 전체 카탈로그(IDs 포함)를 fetch해 CatalogClient에 넘긴다.
 * 공개 페이지의 supabaseStorage.getPlaylist()와 달리 content_sources.id 등 모든 PK를
 * 포함한 adminAction을 사용한다. 변경 후 revalidatePath는 각 액션에서 처리한다.
 *
 * 레이아웃: 데이터-툴 풀-블리드. TopBar/툴바/테이블 뷰포트는 CatalogClient가
 * DataPageShell로 직접 구성한다(이 서버 컴포넌트는 카드/지표행 없이 그대로 렌더).
 */
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  // 레이아웃 게이트가 이미 관리자만 통과시키지만, 데이터 접근부에서도 한 번 더 확인한다.
  await requireAdmin();
  const seasons = await getCatalogAdmin();

  return <CatalogClient initialSeasons={seasons} />;
}
