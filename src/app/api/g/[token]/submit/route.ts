import { NextResponse } from "next/server";
import { db, getGalleryByToken, getSelections } from "@/lib/db";
import { runCopy } from "@/lib/submit";

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const gallery = getGalleryByToken(token);
  if (!gallery) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (gallery.status === "submitted") return NextResponse.json({ ok: true });

  if (getSelections(gallery.id).length === 0) {
    return NextResponse.json({ error: "Select at least one photo first." }, { status: 400 });
  }

  db.prepare("UPDATE galleries SET status = 'submitted', submitted_at = datetime('now') WHERE id = ?").run(
    gallery.id,
  );
  // The client's submission is already saved; a Drive failure is surfaced to the admin, not the client.
  await runCopy(gallery);
  return NextResponse.json({ ok: true });
}
