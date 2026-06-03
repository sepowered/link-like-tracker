import { NextResponse } from "next/server";
import { getRequestPlaylistStorage } from "@/lib/playlist";

export async function GET() {
  try {
    const storage = await getRequestPlaylistStorage();
    const data = await storage.getPlaylist();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to load playlist", error);
    return NextResponse.json(
      { error: "Failed to load playlist" },
      { status: 500 }
    );
  }
}
