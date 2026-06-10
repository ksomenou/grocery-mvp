import Link from "next/link"
import { redirect } from "next/navigation"

import { LoginForm } from "@/components/login-form"
import { getCurrentUser } from "@/lib/auth"
import { isAdminRole, loginRedirectDestination } from "@/lib/permissions"
import { storeName } from "@/lib/store" 

export const dynamic = "force-dynamic"

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string; reset?: string }>
}) {
  const params = await searchParams
  const user = await getCurrentUser()

  if (user) {
    const destination = isAdminRole(user.role) ? loginRedirectDestination(user.role, params.next) : "/"
    console.info("[login authenticated redirect]", { destination, next: params.next ?? "", role: user.role })
    redirect(destination)
  }

  return (
    <main className="shell">
      <section className="panel auth-panel">
        <h1 style={{ marginTop: 0 }}>Log in</h1>
        <p className="muted">Access your {storeName} account or store admin tools.</p>
        <LoginForm error={params.error} next={params.next} reset={params.reset} />
        <p className="muted">New to {storeName}? <Link href="/register">Create an account</Link></p>
      </section>
    </main>
  )
}
