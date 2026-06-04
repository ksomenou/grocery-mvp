import Link from "next/link"

import { registerUser } from "@/lib/auth"

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const error = params.error === "duplicate"
    ? "An account with that email already exists."
    : params.error
      ? "Please enter a valid name, email, and password of at least 8 characters."
      : ""

  return (
    <main className="shell">
      <section className="panel auth-panel">
        <h1 style={{ marginTop: 0 }}>Create account</h1>
        <p className="muted">Register for faster checkout and order history.</p>
        <form action={registerUser} className="form-grid">
          <label className="form-field">
            <span>Name</span>
            <input className="field" name="name" placeholder="Full name" required />
          </label>
          <label className="form-field">
            <span>Email</span>
            <input className="field" name="email" placeholder="you@example.com" required type="email" />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input className="field" minLength={8} name="password" placeholder="At least 8 characters" required type="password" />
          </label>
          {error ? <p className="field-error">{error}</p> : null}
          <button className="button" type="submit">Create account</button>
        </form>
        <p className="muted">Already have an account? <Link href="/login">Log in</Link></p>
      </section>
    </main>
  )
}
