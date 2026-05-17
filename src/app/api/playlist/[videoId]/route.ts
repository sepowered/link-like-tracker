import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { storage } from "@/lib/playlist";
import { CategoryOverrideValue } from "@/lib/storage";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId: contentId } = await params;

    let body: { categoryOverride?: CategoryOverrideValue | "auto" } = {};
    try {
      body = await request.json();
    } catch {
      // no body → toggle watched
    }

    if ("categoryOverride" in body) {
      const result = await storage.setCategoryOverride(contentId, body.categoryOverride ?? "auto");

      if (!result) {
        return NextResponse.json({ error: "Content not found" }, { status: 404 });
      }

      revalidatePath("/");
      return NextResponse.json(result);
    }

    const result = await storage.toggleWatched(contentId);

    if (!result) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    revalidatePath("/");
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to update video", error);
    return NextResponse.json({ error: "Failed to update video" }, { status: 500 });
  }
}
