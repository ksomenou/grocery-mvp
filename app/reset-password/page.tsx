import Link from "next/link"

import { ResetPasswordForm } from "@/components/reset-password-form"

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token = "" } = await searchParams

  return (
    <main className="shell">
      <section className="panel auth-panel">
        <h1 style={{ marginTop: 0 }}>Reset password</h1>
        <p className="muted">Choose a new password for your account.</p>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p className="field-error">Reset link is invalid or expired.</p>
        )}
        <p className="muted">Back to <Link href="/login">log in</Link></p>
      </section>
    </main>
  )
}
