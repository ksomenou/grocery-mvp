import Link from "next/link"

import { loginUser } from "@/lib/auth"
import { storeName } from "@/lib/store"

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string; reset?: string }>
}) {
  const params = await searchParams

  return (
    <main className="shell">
      <section className="panel auth-panel">
        <h1 style={{ marginTop: 0 }}>Log in</h1>
        <p className="muted">Access your {storeName} account or store admin tools.</p>
        <form action={loginUser} className="form-grid">
          <input name="next" type="hidden" value={params.next ?? ""} />
          <label className="form-field">
            <span>Email</span>
            <input className="field" name="email" placeholder="you@example.com" required type="email" />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input className="field" minLength={1} name="password" placeholder="Password" required type="password" />
          </label>
          <Link className="auth-inline-link" href="/forgot-password">Forgot password?</Link>
          {params.reset === "success" ? <p className="field-success">Password reset successfully. Please log in.</p> : null}
          {params.error ? <p className="field-error">Invalid email or password.</p> : null}
          <button className="button" type="submit">Log in</button>
        </form>
        <p className="muted">New to {storeName}? <Link href="/register">Create an account</Link></p>
      </section>
    </main>
  )
}
