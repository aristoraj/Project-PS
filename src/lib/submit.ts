import { getSelections, setCopyResult, type Gallery } from "./db";
import { copySelectionsToDrive, driveMode } from "./drive";

/** Runs the Drive copy for a gallery's current selections and records the outcome. */
export async function runCopy(gallery: Gallery) {
  // Public-link (API key) mode is read-only: selections stay in the app for the admin to open.
  if ((await driveMode()) !== "oauth") return { status: "none" as const, error: null };
  const selections = await getSelections(gallery.id);  const result = await copySelectionsToDrive(gallery, selections);
  await setCopyResult(gallery.id, result.status, result.error);
  return result;
}
