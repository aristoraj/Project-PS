"use server";

import { redirect } from "next/navigation";
import { checkPassword, endAdminSession, requireAdmin, startAdminSession } from "@/lib/auth";
import { createGallery, deleteGallery as removeGallery, getGalleryById, reopenGallery as reopen } from "@/lib/db";
import { getFolder, parseFolderId } from "@/lib/drive";
import { runCopy } from "@/lib/submit";

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) redirect("/admin/login?error=1");
  await startAdminSession();
  redirect("/admin");
}

export async function logout() {
  await endAdminSession();
  redirect("/admin/login");
}

export async function createClientGallery(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const link = String(formData.get("link") ?? "");
  const folderId = parseFolderId(link);

  let error = "";
  let id = 0;
  if (!name) error = "Enter the client's name.";
  else if (!folderId) error = "That doesn't look like a Google Drive folder link.";
  else {
    try {
      const folder = await getFolder(folderId);
      id = (await createGallery(name, folder.id, folder.name)).id;
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not open that folder.";
    }
  }
  if (error) redirect(`/admin/new?error=${encodeURIComponent(error)}`);
  redirect(`/admin/${id}`);
}

export async function retryCopy(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const gallery = await getGalleryById(id);
  if (gallery) await runCopy(gallery);
  redirect(`/admin/${id}`);
}

export async function reopenGallery(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  await reopen(id);
  redirect(`/admin/${id}`);
}

export async function deleteGallery(formData: FormData) {
  await requireAdmin();
  // Removes the record and share link only; nothing in Google Drive is touched.
  await removeGallery(Number(formData.get("id")));
  redirect("/admin");
}
