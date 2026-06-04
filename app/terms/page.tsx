import { storeName } from "@/lib/store"

export const metadata = {
  title: "Terms"
}

export default function TermsPage() {
  return (
    <main className="shell">
      <section className="panel auth-panel">
        <h1 style={{ marginTop: 0 }}>Terms</h1>
        <p className="muted">
          By shopping with {storeName}, you agree to provide accurate checkout information, pay for
          confirmed orders, and use the service for lawful personal grocery purchases. Product
          availability, prices, and delivery windows may change before checkout is completed.
        </p>
      </section>
    </main>
  )
}
