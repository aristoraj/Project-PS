import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import CopyButton from "@/components/CopyButton";
import { getGalleryById, getSelections } from "@/lib/db";
import { driveFolderUrl, SELECTED_FOLDER_NAME } from "@/lib/drive";
import { deleteGallery, reopenGallery, retryCopy } from "../../actions";

export const dynamic = "force-dynamic";

export default async function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gallery = await getGalleryById(Number(id));
  if (!gallery) notFound();

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const shareUrl = `${proto}://${host}/g/${gallery.token}`;
  const selections = await getSelections(gallery.id);
  const names = selections.map((s) => s.file_name).join("\n");
  const submitted = gallery.status === "submitted";

  return (
    <>
      <Link href="/admin" className="muted">← Clients</Link>
      <div className="row between">
        <h1>{gallery.client_name}</h1>
        <span className={`pill ${gallery.status}`}>{submitted ? "Submitted" : "Waiting for client"}</span>
      </div>

      <section className="card stack">
        <h2>Share link</h2>
        <div className="row">
          <input readOnly value={shareUrl} />
          <CopyButton text={shareUrl} label="Copy link" />
          <a className="btn" href={shareUrl} target="_blank" rel="noreferrer">Preview</a>
        </div>
        <small className="muted">
          Anyone with this link can view and choose photos from “{gallery.drive_folder_name}”. Your Drive links are
          never shown to them.
        </small>
      </section>

      <section className="card stack">
        <h2>Selected photos ({selections.length})</h2>

        {submitted && (
          <div className={`notice ${gallery.copy_status === "done" ? "ok" : "warn"}`}>
            {gallery.copy_status === "done" && (
              <>
                Copied to “{SELECTED_FOLDER_NAME}” inside your Drive folder.{" "}
                {gallery.selected_folder_id && (
                  <a href={driveFolderUrl(gallery.selected_folder_id)} target="_blank" rel="noreferrer">
                    Open folder ↗
                  </a>
                )}
              </>
            )}
            {gallery.copy_status === "partial" && <>Some photos could not be copied.</>}
            {gallery.copy_status === "failed" && <>Copying to Drive failed.</>}
            {gallery.copy_status === "none" && (
              <>Saved in the app. Click a photo below to open it in Drive, or copy the file names to search your folder.</>
            )}
            {gallery.copy_error && <pre>{gallery.copy_error}</pre>}
          </div>
        )}
        {!submitted && <p className="muted">The client hasn&apos;t submitted yet. This list updates as they choose.</p>}

        {selections.length > 0 && (
          <>
            <div className="thumbs">
              {selections.map((s) => (
                <figure key={s.file_id}>
                  <a href={`https://drive.google.com/file/d/${s.file_id}/view`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/img/${gallery.token}/${s.file_id}?s=400`} alt={s.file_name} loading="lazy" />
                  </a>
                  <figcaption>{s.file_name}</figcaption>
                </figure>
              ))}
            </div>
            <div className="row">
              <CopyButton text={names} label="Copy file names" />
              {submitted && (
                <form action={retryCopy}>
                  <input type="hidden" name="id" value={gallery.id} />
                  <button className="btn">Copy to Drive again</button>
                </form>
              )}
            </div>
          </>
        )}
      </section>

      <section className="row">
        {submitted && (
          <form action={reopenGallery}>
            <input type="hidden" name="id" value={gallery.id} />
            <button className="btn">Reopen for client</button>
          </form>
        )}
        <a className="btn" href={driveFolderUrl(gallery.drive_folder_id)} target="_blank" rel="noreferrer">
          Open Drive folder ↗
        </a>
        <form action={deleteGallery}>
          <input type="hidden" name="id" value={gallery.id} />
          <button className="btn danger">Delete client (keeps Drive files)</button>
        </form>
      </section>
    </>
  );
}
