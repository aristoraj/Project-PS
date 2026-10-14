import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
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

const g = globalThis as unknown as { __db?: Database.Database };

function open(): Database.Database {
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "app.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS galleries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      client_name TEXT NOT NULL,
      drive_folder_id TEXT NOT NULL,
      drive_folder_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
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
  `);
  db.pragma("foreign_keys = ON");
  return db;
}

export const db = g.__db ?? (g.__db = open());

export function getSetting(key: string): string | undefined {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}

export function listGalleries(): (Gallery & { selected_count: number })[] {
  return db
    .prepare(
      `SELECT g.*, (SELECT COUNT(*) FROM selections s WHERE s.gallery_id = g.id) AS selected_count
       FROM galleries g ORDER BY g.id DESC`,
    )
    .all() as (Gallery & { selected_count: number })[];
}

export function getGalleryById(id: number): Gallery | undefined {
  return db.prepare("SELECT * FROM galleries WHERE id = ?").get(id) as Gallery | undefined;
}

export function getGalleryByToken(token: string): Gallery | undefined {
  return db.prepare("SELECT * FROM galleries WHERE token = ?").get(token) as Gallery | undefined;
}

export function createGallery(clientName: string, folderId: string, folderName: string): Gallery {
  const token = crypto.randomBytes(16).toString("base64url");
  const info = db
    .prepare(
      "INSERT INTO galleries (token, client_name, drive_folder_id, drive_folder_name) VALUES (?, ?, ?, ?)",
    )
    .run(token, clientName, folderId, folderName);
  return getGalleryById(Number(info.lastInsertRowid))!;
}

export function getSelections(galleryId: number): Selection[] {
  return db
    .prepare("SELECT * FROM selections WHERE gallery_id = ? ORDER BY file_name")
    .all(galleryId) as Selection[];
}

export function setSelected(galleryId: number, fileId: string, fileName: string, on: boolean) {
  if (on) {
    db.prepare("INSERT OR IGNORE INTO selections (gallery_id, file_id, file_name) VALUES (?, ?, ?)").run(
      galleryId,
      fileId,
      fileName,
    );
  } else {
    db.prepare("DELETE FROM selections WHERE gallery_id = ? AND file_id = ?").run(galleryId, fileId);
  }
}
