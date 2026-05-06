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

  let video = null;
  for (const season of data.seasons) {
    const found = season.videos.find((v) => v.id === videoId);
    if (found) {
      video = found;
      break;
    }
  }

  if (!video) notFound();

  const seen = new Set<string>();
  for (const season of data.seasons) {
    seen.add(season.id.split("-")[0]);
  }
  const generations = [...seen];

  return <EditRequestForm video={video} generations={generations} />;
}
