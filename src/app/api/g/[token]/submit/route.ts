import { NextResponse } from "next/server";
import { getGalleryByToken, getSelections, markSubmitted } from "@/lib/db";
import { runCopy } from "@/lib/submit";

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const gallery = await getGalleryByToken(token);
  if (!gallery) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (gallery.status === "submitted") return NextResponse.json({ ok: true });

  if ((await getSelections(gallery.id)).length === 0) {
    return NextResponse.json({ error: "Select at least one photo first." }, { status: 400 });
  }

  await markSubmitted(gallery.id);
  // The client's submission is already saved; a Drive failure is surfaced to the admin, not the client.
  await runCopy(gallery);
  return NextResponse.json({ ok: true });
}
