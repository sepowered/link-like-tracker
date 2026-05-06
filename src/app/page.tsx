import { storage } from "@/lib/playlist";
import PlaylistView from "@/components/PlaylistView";

export default async function Home() {
  const data = await storage.getPlaylist();
  return (
    <main className="container">
      <PlaylistView initialData={data} />
    </main>
  );
}
