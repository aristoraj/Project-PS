import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { googleConfigured, oauthClient } from "@/lib/drive";

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.redirect(new URL("/admin/login", req.url));
  if (!googleConfigured()) {
    return new NextResponse("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set. See README.", { status: 500 });
  }
  const url = oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // always return a refresh token
    scope: ["https://www.googleapis.com/auth/drive"],
  });
  return NextResponse.redirect(url);
}
