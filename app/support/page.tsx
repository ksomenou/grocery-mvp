import { storeName } from "@/lib/store"

export const metadata = {
  title: "Support"
}

export default function SupportPage() {
  return (
    <main className="shell">
      <section className="panel auth-panel">
        <h1 style={{ marginTop: 0 }}>Support</h1>
        <p className="muted">
          Need help with an order from {storeName}? Contact the store with your order number,
          checkout email, and a short description of the issue so the team can review it quickly.
        </p>
      </section>
    </main>
  )
}
