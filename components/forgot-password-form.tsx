"use client"

import { FormEvent, useState } from "react"

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error ?? "Please enter a valid email address.")
        return
      }

      setMessage(data.message ?? "If an account exists, we’ll send a reset link.")
    } catch {
      setError("Password reset is unavailable right now. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="form-field">
        <span>Email</span>
        <input
          className="field"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
      </label>
      {message ? <p className="field-success">{message}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
      <button className="button" disabled={loading} type="submit">
        {loading ? "Sending..." : "Send reset link"}
      </button>
    </form>
  )
}
