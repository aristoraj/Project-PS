import Link from "next/link";
import { listGalleries } from "@/lib/db";
import { driveConnected, googleConfigured } from "@/lib/drive";

export const dynamic = "force-dynamic";

const DRIVE_MSG: Record<string, string> = {
  connected: "Google Drive connected.",
  denied: "Google sign-in was cancelled.",
  norefresh:
    "Google didn't return a refresh token. Remove this app at myaccount.google.com/permissions and try again.",
};

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ drive?: string }> }) {
  const { drive } = await searchParams;
  const galleries = await listGalleries();
  const connected = await driveConnected();

  return (
    <>
      {drive && DRIVE_MSG[drive] && (
        <p className={drive === "connected" ? "notice ok" : "notice warn"}>{DRIVE_MSG[drive]}</p>
      )}

      {!connected && (
        <div className="notice warn">
          {googleConfigured() ? (
            <>
              Google Drive isn&apos;t connected yet. <a href="/api/google/connect">Connect Google Drive</a>
            </>
          ) : (
            <>Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local, then restart. See README.</>
          )}
        </div>
      )}

      <div className="row between">
        <h1>Clients</h1>
        <Link href="/admin/new" className="btn primary">+ New client</Link>
      </div>

      {galleries.length === 0 ? (
        <p className="muted">No clients yet. Create one to get a shareable link.</p>
      ) : (
        <div className="card table">
          <div className="tr th">
            <span>Client</span>
            <span>Status</span>
            <span>Selected</span>
            <span>Created</span>
          </div>
          {galleries.map((g) => (
            <Link key={g.id} href={`/admin/${g.id}`} className="tr">
              <span><strong>{g.client_name}</strong></span>
              <span>
                <span className={`pill ${g.status}`}>
                  {g.status === "submitted" ? "Submitted" : "Waiting for client"}
                </span>
              </span>
              <span>{g.selected_count}</span>
              <span className="muted">{g.created_at.slice(0, 10)}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
