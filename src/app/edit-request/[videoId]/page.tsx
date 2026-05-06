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

  return <EditRequestForm video={video} />;
}
