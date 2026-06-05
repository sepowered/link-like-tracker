import { requireAdmin } from "@/lib/admin/require-admin";
import { getCatalogAdmin } from "@/lib/admin/catalog-repo";
import CatalogClient from "./CatalogClient";

/**
 * 카탈로그 관리 페이지 — /admin/catalog
 *
 * 서버 컴포넌트: service_role로 전체 카탈로그(IDs 포함)를 fetch해 CatalogClient에 넘긴다.
 * 공개 페이지의 supabaseStorage.getPlaylist()와 달리 content_sources.id 등 모든 PK를
 * 포함한 adminAction을 사용한다. 변경 후 revalidatePath는 각 액션에서 처리한다.
 */
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  // 레이아웃 게이트가 이미 관리자만 통과시키지만, 데이터 접근부에서도 한 번 더 확인한다.
  await requireAdmin();
  const seasons = await getCatalogAdmin();

  const episodeCount = seasons.reduce((n, s) => n + s.episodes.length, 0);
  const contentCount = seasons.reduce(
    (n, s) => n + s.episodes.reduce((m, e) => m + e.contents.length, 0),
    0,
  );

  return (
    <div style={{ maxWidth: "900px" }}>
      <h1
        style={{
          fontSize: "20px",
          fontWeight: 700,
          color: "var(--seed-color-fg-neutral)",
          marginBottom: "4px",
          letterSpacing: "-0.02em",
        }}
      >
        카탈로그
      </h1>
      <p
        style={{
          fontSize: "13px",
          color: "var(--seed-color-fg-neutral-subtle)",
          marginBottom: "24px",
        }}
      >
        시즌 {seasons.length}개 · 에피소드 {episodeCount}개 · 콘텐츠 {contentCount}개
      </p>

      <CatalogClient initialSeasons={seasons} />
    </div>
  );
}
