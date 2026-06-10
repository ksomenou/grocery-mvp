"use client"

import Link from "next/link"

import { loginUser } from "@/lib/auth"

export function LoginForm({
  error,
  next,
  reset
}: {
  error?: string
  next?: string
  reset?: string
}) {
  return (
    <form action={loginUser} className="form-grid">
      <input name="next" type="hidden" value={next ?? ""} />

      <label className="form-field">
        <span>Email</span>
        <input className="field" name="email" placeholder="you@example.com" required type="email" />
      </label>

      <label className="form-field">
        <span>Password</span>
        <input className="field" minLength={1} name="password" placeholder="Password" required type="password" />
      </label>

      <Link className="auth-inline-link" href="/forgot-password">
        Forgot password?
      </Link>

      {reset === "success" ? <p className="field-success">Password reset successfully. Please log in.</p> : null}
      {error ? <p className="field-error">Invalid email or password.</p> : null}

      <button className="button" type="submit">
        Log in
      </button>
    </form>
  )
}