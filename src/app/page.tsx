import { getRequestPlaylistStorage } from "@/lib/playlist";
import { getLatestAnnouncementBanner } from "@/lib/announcements";
import PlaylistView from "@/components/PlaylistView";

export const dynamic = "force-dynamic";

export default async function Home() {
  const storage = await getRequestPlaylistStorage();
  const [data, latestUpdate] = await Promise.all([
    storage.getPlaylist(),
    getLatestAnnouncementBanner(),
  ]);
  return (
    <main className="container">
      <PlaylistView initialData={data} latestUpdate={latestUpdate} />
    </main>
  );
}
