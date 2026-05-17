import { storage } from "@/lib/playlist";
import { notFound } from "next/navigation";
import EditRequestForm from "./EditRequestForm";

export default async function EditRequestPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  const data = await storage.getPlaylist();

  let content = null;
  let episodeTitle = "";
  for (const season of data.seasons) {
    for (const episode of season.episodes) {
      const found = episode.contents.find((c) => c.id === videoId);
      if (found) {
        content = found;
        episodeTitle = episode.title_ko;
        break;
      }
    }
    if (content) break;
  }

  if (!content) notFound();

  const seen = new Set<string>();
  for (const season of data.seasons) {
    seen.add(season.id.split("-")[0]);
  }
  const generations = [...seen];

  return <EditRequestForm content={content} episodeTitle={episodeTitle} generations={generations} />;
}
