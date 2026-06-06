import { storeName } from "@/lib/store"

export const metadata = {
  title: "About"
}

const reasons = [
  "Fresh produce and quality groceries",
  "Authentic African and Caribbean foods",
  "Convenient local delivery",
  "Easy online ordering",
  "Secure checkout",
  "Friendly customer service",
  "Pickup options available"
]

export default function AboutPage() {
  return (
    <main className="shell">
      <section className="panel policy-panel">
        <p className="admin-kicker">About</p>
        <h1>About {storeName}</h1>
        <p className="muted">
          Welcome to <strong>{storeName}</strong>, your trusted source for fresh groceries,
          authentic international foods, and everyday household essentials.
        </p>

        <div className="policy-sections">
          <section>
            <p>
              We proudly serve our local community by offering a wide selection of African,
              Caribbean, and international products alongside fresh produce, meat, seafood,
              pantry staples, frozen foods, beverages, and household necessities.
            </p>
            <p>
              Our mission is to make grocery shopping simple, convenient, and affordable. Whether
              you prefer <strong>local delivery</strong> or <strong>store pickup</strong>, we are
              committed to providing quality products, reliable service, and a secure shopping
              experience.
            </p>
            <p>
              At {storeName}, we believe food brings people together. That&apos;s why we work hard
              to stock the products and ingredients that help families prepare the meals they know
              and love.
            </p>
            <p>
              Thank you for choosing <strong>{storeName}</strong>. We look forward to serving you
              and your family.
            </p>
          </section>

          <section>
            <h2>Why Shop With Us?</h2>
            <ul>
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </section>

          <section>
            <p>
              <strong>Fresh groceries • Local delivery • Secure checkout • Pickup available</strong>
            </p>
          </section>
        </div>
      </section>
    </main>
  )
}
