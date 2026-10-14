import { NextResponse } from "next/server";
import { getGalleryByToken, setSelected } from "@/lib/db";
import { listPhotos } from "@/lib/drive";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const gallery = getGalleryByToken(token);
  if (!gallery) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (gallery.status === "submitted") {
    return NextResponse.json({ error: "Selection already submitted" }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as { fileId?: string; selected?: boolean } | null;
  if (!body?.fileId || typeof body.selected !== "boolean") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const photos = await listPhotos(gallery.drive_folder_id);
  const photo = photos.find((p) => p.id === body.fileId);
  if (!photo) return NextResponse.json({ error: "Photo not in this gallery" }, { status: 404 });

  setSelected(gallery.id, photo.id, photo.name, body.selected);
  return NextResponse.json({ ok: true });
}
