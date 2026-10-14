import { getSelections, setCopyResult, type Gallery } from "./db";
import { copySelectionsToDrive } from "./drive";

/** Runs the Drive copy for a gallery's current selections and records the outcome. */
export async function runCopy(gallery: Gallery) {
  const selections = await getSelections(gallery.id);
  const result = await copySelectionsToDrive(gallery, selections);
  await setCopyResult(gallery.id, result.status, result.error);
  return result;
}
