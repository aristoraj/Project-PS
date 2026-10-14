import { NextResponse } from "next/server";
import { getGalleryByToken } from "@/lib/db";
import { fetchThumbnail } from "@/lib/drive";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string; fileId: string }> },
) {
  const { token, fileId } = await params;
  const gallery = getGalleryByToken(token);
  if (!gallery) return new NextResponse("Not found", { status: 404 });

  const raw = Number(new URL(req.url).searchParams.get("s") ?? 400);
  const size = Math.min(2000, Math.max(100, Number.isFinite(raw) ? Math.round(raw) : 400));

  try {
    const img = await fetchThumbnail(gallery.drive_folder_id, fileId, size);
    if (!img) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(img.body, {
      headers: {
        "Content-Type": img.contentType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Could not load image", { status: 502 });
  }
}
