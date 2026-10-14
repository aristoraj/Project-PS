import Link from "next/link";
import { createClientGallery } from "../../actions";

export default async function NewClient({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="narrow">
      <Link href="/admin" className="muted">← Clients</Link>
      <h1>New client</h1>
      <form action={createClientGallery} className="card stack">
        <label>
          Client name
          <input name="name" placeholder="e.g. Priya & Arjun – Engagement" required autoFocus />
        </label>
        <label>
          Google Drive folder link
          <input name="link" placeholder="https://drive.google.com/drive/folders/…" required />
          <small className="muted">
            The folder with this client&apos;s photos. Your connected Google account must be able to edit it.
          </small>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary">Create &amp; get share link</button>
      </form>
    </div>
  );
}
