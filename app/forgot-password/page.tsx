import Link from "next/link"

import { ForgotPasswordForm } from "@/components/forgot-password-form"
import { storeName } from "@/lib/store"

export default function ForgotPasswordPage() {
  return (
    <main className="shell">
      <section className="panel auth-panel">
        <h1 style={{ marginTop: 0 }}>Forgot password?</h1>
        <p className="muted">Enter your {storeName} account email and we’ll send a reset link.</p>
        <ForgotPasswordForm />
        <p className="muted">Remember your password? <Link href="/login">Log in</Link></p>
      </section>
    </main>
  )
}
