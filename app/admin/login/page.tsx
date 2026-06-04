import { redirect } from "next/navigation"

export default async function AdminLoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const resolvedSearchParams = await searchParams
  redirect(`/login?next=${encodeURIComponent(resolvedSearchParams.next ?? "/admin")}`)
}
