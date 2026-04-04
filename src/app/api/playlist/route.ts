import { NextResponse } from "next/server";
import { storage } from "@/lib/playlist";

export async function GET() {
  try {
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
