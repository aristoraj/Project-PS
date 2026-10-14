import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logout } from "../actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="admin">
      <header className="topbar">
        <Link href="/admin" className="brand">Photo Selector</Link>
        <form action={logout}>
          <button className="btn ghost">Sign out</button>
        </form>
      </header>
      <main className="container">{children}</main>
    </div>
  );
}
