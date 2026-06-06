import Link from "next/link"
import { redirect } from "next/navigation"

import { hasAdminUser, setupFirstAdmin } from "@/lib/auth"
import { storeName } from "@/lib/store"

export default async function AdminSetupPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if (await hasAdminUser()) {
    redirect("/login")
  }

  const params = await searchParams

  return (
    <main className="shell">
      <section className="panel auth-panel">
        <h1 style={{ marginTop: 0 }}>Create store admin</h1>
        <p className="muted">Set up the first admin account for {storeName}. This page closes after an admin exists.</p>
        <form action={setupFirstAdmin} className="form-grid">
          <label className="form-field">
            <span>Email</span>
            <input className="field" name="email" placeholder="owner@example.com" required type="email" />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input className="field" minLength={8} name="password" placeholder="At least 8 characters" required type="password" />
          </label>
          <label className="form-field">
            <span>Confirm password</span>
            <input className="field" minLength={8} name="confirmPassword" placeholder="Confirm password" required type="password" />
          </label>
          {params.error === "duplicate" ? <p className="field-error">That email is already registered. Use a different email.</p> : null}
          {params.error === "invalid" ? <p className="field-error">Check the email and make sure both passwords match.</p> : null}
          <button className="button" type="submit">Create admin account</button>
        </form>
        <p className="muted">Already set up? <Link href="/login">Log in</Link></p>
      </section>
    </main>
  )
}
