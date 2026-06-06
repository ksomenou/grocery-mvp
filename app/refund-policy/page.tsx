import { storeName } from "@/lib/store"

export const metadata = {
  title: "Refund Policy"
}

const policySections = [
  {
    title: "1. Fresh Produce & Perishable Items",
    body: "Because we sell fresh and perishable goods, refunds or replacements are only available if:",
    items: [
      "The item was damaged, spoiled, expired, or incorrect at the time of delivery or pickup",
      "A product is missing from your order",
      "You received the wrong item"
    ],
    note: "Issues must be reported within 24 hours of receiving your order."
  },
  {
    title: "2. Non-Perishable Items",
    body: "Non-perishable products may be eligible for a refund or exchange within 7 days of purchase if the item is unopened, unused, and in its original packaging."
  },
  {
    title: "3. Delivery Issues",
    body: "If your order arrives incomplete, incorrect, or damaged during delivery, please contact us as soon as possible.",
    note: "We may offer a replacement, store credit, partial refund, or full refund depending on the situation. Delivery fees are generally non-refundable once delivery has been completed."
  },
  {
    title: "4. Pickup Orders",
    body: "Customers are encouraged to inspect pickup orders at the time of collection.",
    note: "Once products leave the store, refunds on perishable items may be limited unless there is a verified quality issue."
  },
  {
    title: "5. Refund Processing Time",
    body: "Approved refunds are processed back to the original payment method within 5-10 business days, depending on your bank or payment provider."
  },
  {
    title: "6. Non-Refundable Items",
    body: "We do not offer refunds for:",
    items: [
      "Products consumed or partially used",
      "Incorrect orders placed by customers",
      "Requests made outside the allowed reporting period",
      "Items damaged due to improper storage after delivery or pickup"
    ]
  },
  {
    title: "7. Order Cancellations",
    body: "Orders may be canceled before they are prepared or dispatched.",
    note: "Once preparation or delivery has started, cancellation requests may not be eligible for a refund."
  }
]

export default function RefundPolicyPage() {
  return (
    <main className="shell">
      <section className="panel policy-panel">
        <p className="admin-kicker">Last Updated: June 4, 2026</p>
        <h1>Refund Policy</h1>
        <p className="muted">
          Welcome to {storeName}. We value our customers and strive to provide fresh,
          high-quality products and excellent service.
        </p>

        <div className="policy-sections">
          {policySections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
              {section.items ? (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {section.note ? <p>{section.note}</p> : null}
            </section>
          ))}

          <section>
            <h2>8. Contact Us</h2>
            <p>
              <strong>{storeName}</strong>
              <br />
              Email: <a href="mailto:support@fainternationalgrocery.com">support@fainternationalgrocery.com</a>
              <br />
              Phone: <a href="tel:+17016517071">(701) 651-7071</a>
              <br />
              Address: 413 Main St #103, Williston, ND 58801
            </p>
          </section>
        </div>
      </section>
    </main>
  )
}
