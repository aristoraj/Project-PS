import { google, type drive_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { db, getSetting, type Gallery } from "./db";

export const SELECTED_FOLDER_NAME = "Selected photos by client";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export type Photo = { id: string; name: string; thumbnailLink: string | null };

export class DriveNotConnectedError extends Error {
  constructor() {
    super("Google Drive is not connected. Open the admin dashboard and click “Connect Google Drive”.");
  }
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function driveConnected(): boolean {
  return Boolean(getSetting("google_refresh_token"));
}

export function oauthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${appUrl()}/api/google/callback`,
  );
}

function authedClient(): OAuth2Client {
  const refresh = getSetting("google_refresh_token");
  if (!refresh) throw new DriveNotConnectedError();
  const client = oauthClient();
  client.setCredentials({ refresh_token: refresh });
  return client;
}

function drive(): drive_v3.Drive {
  return google.drive({ version: "v3", auth: authedClient() });
}

/** Accepts a Drive folder URL (…/folders/ID or …?id=ID) or a bare folder ID. */
export function parseFolderId(input: string): string | null {
  const v = input.trim();
  const m = v.match(/\/folders\/([a-zA-Z0-9_-]+)/) ?? v.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return /^[a-zA-Z0-9_-]{15,}$/.test(v) ? v : null;
}

export async function getFolder(folderId: string): Promise<{ id: string; name: string }> {
  const res = await drive().files.get({
    fileId: folderId,
    fields: "id,name,mimeType",
    supportsAllDrives: true,
  });
  if (res.data.mimeType !== FOLDER_MIME) throw new Error("That link is a file, not a folder.");
  return { id: res.data.id!, name: res.data.name ?? "" };
}

// Short-lived listing cache; Drive thumbnail links stay valid for hours.
const LIST_TTL_MS = 10 * 60 * 1000;
const listCache = new Map<string, { at: number; photos: Photo[] }>();

export async function listPhotos(folderId: string, fresh = false): Promise<Photo[]> {
  const hit = listCache.get(folderId);
  if (!fresh && hit && Date.now() - hit.at < LIST_TTL_MS) return hit.photos;

  const d = drive();
  const photos: Photo[] = [];
  let pageToken: string | undefined;
  do {
    const res = await d.files.list({
      q: `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`,
      fields: "nextPageToken, files(id,name,thumbnailLink)",
      orderBy: "name_natural",
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files ?? []) {
      photos.push({ id: f.id!, name: f.name ?? f.id!, thumbnailLink: f.thumbnailLink ?? null });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  listCache.set(folderId, { at: Date.now(), photos });
  return photos;
}

/** Fetches a resized rendition of a photo through the admin's credentials. */
export async function fetchThumbnail(
  folderId: string,
  fileId: string,
  size: number,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  for (const fresh of [false, true]) {
    const photos = await listPhotos(folderId, fresh);
    const photo = photos.find((p) => p.id === fileId);
    if (!photo?.thumbnailLink) return null;

    const auth = authedClient();
    const { token } = await auth.getAccessToken();
    const url = photo.thumbnailLink.replace(/=s\d+$/, `=s${size}`);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      return {
        body: await res.arrayBuffer(),
        contentType: res.headers.get("content-type") ?? "image/jpeg",
      };
    }
    // Expired link: retry once with a fresh listing.
  }
  return null;
}

async function ensureSelectedFolder(d: drive_v3.Drive, gallery: Gallery): Promise<string> {
  if (gallery.selected_folder_id) {
    try {
      const r = await d.files.get({
        fileId: gallery.selected_folder_id,
        fields: "id,trashed",
        supportsAllDrives: true,
      });
      if (!r.data.trashed) return gallery.selected_folder_id;
    } catch {
      // Folder was deleted; fall through and recreate.
    }
  }
  const existing = await d.files.list({
    q: `'${gallery.drive_folder_id}' in parents and trashed = false and mimeType = '${FOLDER_MIME}' and name = '${SELECTED_FOLDER_NAME}'`,
    fields: "files(id)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  let id = existing.data.files?.[0]?.id;
  if (!id) {
    const created = await d.files.create({
      requestBody: { name: SELECTED_FOLDER_NAME, mimeType: FOLDER_MIME, parents: [gallery.drive_folder_id] },
      fields: "id",
      supportsAllDrives: true,
    });
    id = created.data.id!;
  }
  db.prepare("UPDATE galleries SET selected_folder_id = ? WHERE id = ?").run(id, gallery.id);
  return id;
}

/**
 * Copies the client's selected photos into "Selected photos by client" inside the
 * project's Drive folder. Safe to re-run: files already copied (same name) are skipped.
 */
export async function copySelectionsToDrive(
  gallery: Gallery,
  files: { file_id: string; file_name: string }[],
): Promise<{ status: "done" | "partial" | "failed"; error: string | null }> {
  try {
    const d = drive();
    const folderId = await ensureSelectedFolder(d, gallery);

    const already = new Set<string>();
    let pageToken: string | undefined;
    do {
      const r = await d.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: "nextPageToken, files(name)",
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      for (const f of r.data.files ?? []) if (f.name) already.add(f.name);
      pageToken = r.data.nextPageToken ?? undefined;
    } while (pageToken);

    const todo = files.filter((f) => !already.has(f.file_name));
    const errors: string[] = [];
    let ok = files.length - todo.length;

    const queue = [...todo];
    const worker = async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        try {
          await d.files.copy({
            fileId: f.file_id,
            requestBody: { name: f.file_name, parents: [folderId] },
            supportsAllDrives: true,
          });
          ok++;
        } catch (e) {
          errors.push(`${f.file_name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));

    if (errors.length === 0) return { status: "done", error: null };
    return {
      status: ok > 0 ? "partial" : "failed",
      error: errors.slice(0, 5).join("\n") + (errors.length > 5 ? `\n…and ${errors.length - 5} more` : ""),
    };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}

export function driveFolderUrl(id: string): string {
  return `https://drive.google.com/drive/folders/${id}`;
}
