import { storeName } from "@/lib/store"

export const metadata = {
  title: "Refund Policy"
}

export default function RefundPolicyPage() {
  return (
    <main className="shell">
      <section className="panel auth-panel">
        <h1 style={{ marginTop: 0 }}>Refund Policy</h1>
        <p className="muted">
          If an item is missing, damaged, unavailable, or not up to standard, contact support with
          your order details. {storeName} reviews refund requests promptly and may issue a refund,
          replacement, or store adjustment when appropriate.
        </p>
      </section>
    </main>
  )
}
