import { storeName } from "@/lib/store"

export const metadata = {
  title: "Privacy"
}

export default function PrivacyPage() {
  return (
    <main className="shell">
      <section className="panel auth-panel">
        <h1 style={{ marginTop: 0 }}>Privacy</h1>
        <p className="muted">
          {storeName} uses customer information to process orders, support delivery or pickup, and
          provide account history when customers choose to register. Payment details are handled by
          Stripe and are not stored by this storefront.
        </p>
      </section>
    </main>
  )
}
