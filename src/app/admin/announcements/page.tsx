import { requireAdmin } from "@/lib/admin/require-admin";
import { listAnnouncements } from "@/lib/admin/announcements-repo";
import AnnouncementsManager from "./AnnouncementsManager";

export const dynamic = "force-dynamic";

/**
 * /admin/announcements — 공지 관리 (서버 컴포넌트).
 */
export default async function AdminAnnouncementsPage() {
  await requireAdmin();

  const announcements = await listAnnouncements();

  return <AnnouncementsManager initialAnnouncements={announcements} />;
}
