import { db, getSelections, type Gallery } from "./db";
import { copySelectionsToDrive } from "./drive";

/** Runs the Drive copy for a gallery's current selections and records the outcome. */
export async function runCopy(gallery: Gallery) {
  const selections = getSelections(gallery.id);
  const result = await copySelectionsToDrive(gallery, selections);
  db.prepare("UPDATE galleries SET copy_status = ?, copy_error = ? WHERE id = ?").run(
    result.status,
    result.error,
    gallery.id,
  );
  return result;
}
