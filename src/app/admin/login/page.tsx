import { login } from "../actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="login">
      <form action={login} className="card stack">
        <h1>Admin sign in</h1>
        <input type="password" name="password" placeholder="Password" autoFocus required />
        {error && <p className="error">Wrong password.</p>}
        <button className="btn primary">Sign in</button>
      </form>
    </main>
  );
}
