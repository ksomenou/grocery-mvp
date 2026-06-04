"use client"

import { FormEvent, useState } from "react"

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmPassword, password, token })
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Reset link is invalid or expired.")
        return
      }

      window.location.href = data.redirectTo ?? "/login?reset=success"
    } catch {
      setError("Password reset is unavailable right now. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="form-field">
        <span>New password</span>
        <input
          className="field"
          minLength={8}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
          required
          type="password"
          value={password}
        />
      </label>
      <label className="form-field">
        <span>Confirm password</span>
        <input
          className="field"
          minLength={8}
          name="confirmPassword"
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirm password"
          required
          type="password"
          value={confirmPassword}
        />
      </label>
      {error ? <p className="field-error">{error}</p> : null}
      <button className="button" disabled={loading || !token} type="submit">
        {loading ? "Saving..." : "Reset password"}
      </button>
    </form>
  )
}
