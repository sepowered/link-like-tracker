import { requireAdmin } from "@/lib/admin/require-admin";
import { listRequests } from "@/lib/admin/requests-repo";
import { getCatalogAdmin } from "@/lib/admin/catalog-repo";
import RequestsInbox, { type ContentOption, type EpisodeOption } from "./RequestsInbox";

export const dynamic = "force-dynamic";

/**
 * /admin/requests — 요청 인박스 (서버 컴포넌트).
 *
 * 인박스가 요청을 '그 자리에서 처리'할 수 있도록 카탈로그의 슬림 인덱스를
 * 함께 내려준다:
 * - episodes: add 요청 승격 폼의 소속 에피소드 선택지
 * - contents: edit 요청의 연결 콘텐츠 프리필 + 미연결 요청의 콘텐츠 검색
 * 전체 트리(소스 포함)를 내리지 않고 필요한 필드만 추려 페이로드를 줄인다.
 */
export default async function AdminRequestsPage() {
  await requireAdmin();

  const [requests, catalog] = await Promise.all([listRequests(), getCatalogAdmin()]);

  const episodes: EpisodeOption[] = catalog.flatMap((season) =>
    season.episodes.map((ep) => ({
      id: ep.id,
      label: `${season.name} · ${ep.episode_number}화${ep.title_ko ? ` — ${ep.title_ko}` : ""}`,
    })),
  );

  const contents: ContentOption[] = catalog.flatMap((season) =>
    season.episodes.flatMap((ep) =>
      ep.contents.map((c) => ({
        id: c.id,
        episode_id: c.episode_id,
        episodeLabel: `${season.name} · ${ep.episode_number}화`,
        type: c.type,
        title_ko: c.title_ko,
        title_jp: c.title_jp,
        part_label: c.part_label,
        legacy_video_id: c.legacy_video_id,
        category_override: c.category_override,
      })),
    ),
  );

  return <RequestsInbox initialRequests={requests} episodes={episodes} contents={contents} />;
}
