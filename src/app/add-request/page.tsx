import { getRequestPlaylistStorage } from "@/lib/playlist";
import AddRequestForm from "./AddRequestForm";

export const dynamic = "force-dynamic";

export default async function AddRequestPage() {
  const storage = await getRequestPlaylistStorage();
  const data = await storage.getPlaylist();

  const seen = new Set<string>();
  for (const season of data.seasons) {
    seen.add(season.id.split("-")[0]);
  }
  const generations = [...seen];

  return <AddRequestForm generations={generations} />;
}
