import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { setSetting } from "@/lib/db";
import { oauthClient } from "@/lib/drive";

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.redirect(new URL("/admin/login", req.url));
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/admin?drive=denied", req.url));
  const { tokens } = await oauthClient().getToken(code);
  if (!tokens.refresh_token) return NextResponse.redirect(new URL("/admin?drive=norefresh", req.url));
  await setSetting("google_refresh_token", tokens.refresh_token);
  return NextResponse.redirect(new URL("/admin?drive=connected", req.url));
}
