import { storeName } from "@/lib/store"

export const metadata = {
  title: "About"
}

export default function AboutPage() {
  return (
    <main className="shell about-page">
      <section className="panel about-panel">
        <h1 style={{ marginTop: 0 }}>About</h1>
        <p className="muted">
          {storeName} offers local grocery delivery and pickup with fresh produce, pantry staples,
          meat, seafood, African foods, Caribbean foods, and everyday household essentials.
        </p>
        <p className="muted">
          We keep shopping simple for local families: browse international groceries, choose delivery
          or pickup, and check out securely in a few minutes.
        </p>
      </section>
    </main>
  )
}
