import { getRequestPlaylistStorage } from "@/lib/playlist";
import PlaylistView from "@/components/PlaylistView";

export const dynamic = "force-dynamic";

export default async function Home() {
  const storage = await getRequestPlaylistStorage();
  const data = await storage.getPlaylist();
  return (
    <main className="container">
      <PlaylistView initialData={data} />
    </main>
  );
}
