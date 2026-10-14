import { Pool } from "pg";
import crypto from "node:crypto";

export type Gallery = {
  id: number;
  token: string;
  client_name: string;
  drive_folder_id: string;
  drive_folder_name: string;
  status: "open" | "submitted";
  created_at: string;
  submitted_at: string | null;
  selected_folder_id: string | null;
  copy_status: "none" | "done" | "partial" | "failed";
  copy_error: string | null;
};

export type Selection = { gallery_id: number; file_id: string; file_name: string };

const NOW_TEXT = "to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI:SS')";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS galleries (
    id SERIAL PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    client_name TEXT NOT NULL,
    drive_folder_id TEXT NOT NULL,
    drive_folder_name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT ${NOW_TEXT},
    submitted_at TEXT,
    selected_folder_id TEXT,
    copy_status TEXT NOT NULL DEFAULT 'none',
    copy_error TEXT
  );
  CREATE TABLE IF NOT EXISTS selections (
    gallery_id INTEGER NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
    file_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    PRIMARY KEY (gallery_id, file_id)
  );
`;

const g = globalThis as unknown as { __pool?: Pool; __ready?: Promise<unknown> };

function pool(): Pool {
  if (g.__pool) return g.__pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  const local = /localhost|127\.0\.0\.1/.test(url) || process.env.PGSSLMODE === "disable";
  g.__pool = new Pool({
    connectionString: url,
    ssl: local ? undefined : { rejectUnauthorized: false },
    max: 5,
  });
  return g.__pool;
}

async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  if (!g.__ready) {
    g.__ready = pool()
      .query(SCHEMA)
      .catch((e) => {
        g.__ready = undefined; // retry on the next call
        throw e;
      });
  }
  await g.__ready;
  return (await pool().query(text, params)).rows as T[];
}

export async function getSetting(key: string): Promise<string | undefined> {
  const rows = await query<{ value: string }>("SELECT value FROM settings WHERE key = $1", [key]);
  return rows[0]?.value;
}

export async function setSetting(key: string, value: string) {
  await query(
    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    [key, value],
  );
}

export function listGalleries(): Promise<(Gallery & { selected_count: number })[]> {
  return query(
    `SELECT g.*, (SELECT COUNT(*) FROM selections s WHERE s.gallery_id = g.id)::int AS selected_count
     FROM galleries g ORDER BY g.id DESC`,
  );
}

export async function getGalleryById(id: number): Promise<Gallery | undefined> {
  if (!Number.isInteger(id)) return undefined;
  return (await query<Gallery>("SELECT * FROM galleries WHERE id = $1", [id]))[0];
}

export async function getGalleryByToken(token: string): Promise<Gallery | undefined> {
  return (await query<Gallery>("SELECT * FROM galleries WHERE token = $1", [token]))[0];
}

export async function createGallery(clientName: string, folderId: string, folderName: string): Promise<Gallery> {
  const token = crypto.randomBytes(16).toString("base64url");
  const rows = await query<Gallery>(
    `INSERT INTO galleries (token, client_name, drive_folder_id, drive_folder_name)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [token, clientName, folderId, folderName],
  );
  return rows[0];
}

export async function deleteGallery(id: number) {
  if (Number.isInteger(id)) await query("DELETE FROM galleries WHERE id = $1", [id]);
}

export async function markSubmitted(id: number) {
  await query(`UPDATE galleries SET status = 'submitted', submitted_at = ${NOW_TEXT} WHERE id = $1`, [id]);
}

export async function reopenGallery(id: number) {
  if (Number.isInteger(id)) {
    await query("UPDATE galleries SET status = 'open', submitted_at = NULL WHERE id = $1", [id]);
  }
}

export async function setSelectedFolder(id: number, folderId: string) {
  await query("UPDATE galleries SET selected_folder_id = $1 WHERE id = $2", [folderId, id]);
}

export async function setCopyResult(id: number, status: Gallery["copy_status"], error: string | null) {
  await query("UPDATE galleries SET copy_status = $1, copy_error = $2 WHERE id = $3", [status, error, id]);
}

export function getSelections(galleryId: number): Promise<Selection[]> {
  return query("SELECT * FROM selections WHERE gallery_id = $1 ORDER BY file_name", [galleryId]);
}

export async function setSelected(galleryId: number, fileId: string, fileName: string, on: boolean) {
  if (on) {
    await query(
      "INSERT INTO selections (gallery_id, file_id, file_name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [galleryId, fileId, fileName],
    );
  } else {
    await query("DELETE FROM selections WHERE gallery_id = $1 AND file_id = $2", [galleryId, fileId]);
  }
}
