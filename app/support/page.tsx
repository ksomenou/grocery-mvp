import { storeName } from "@/lib/store"

export const metadata = {
  title: "Support"
}

const supportInfo = [
  "Order number",
  "Name used for the order",
  "Email address used at checkout",
  "Brief description of the issue"
]

const commonRequests = [
  "Order status and delivery updates",
  "Delivery questions",
  "Pickup assistance",
  "Missing or damaged items",
  "Product availability",
  "Refund and return requests",
  "Account and checkout issues",
  "Password reset assistance"
]

export default function SupportPage() {
  return (
    <main className="shell">
      <section className="panel policy-panel">
        <p className="admin-kicker">Support</p>
        <h1>We&apos;re Here to Help</h1>
        <p className="muted">
          If you need assistance with an order from {storeName}, our support team is ready to help.
        </p>

        <div className="policy-sections">
          <section>
            <h2>Please include</h2>
            <p>Please include the following information when contacting us:</p>
            <ul>
              {supportInfo.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Contact Information</h2>
            <p>
              Email:
              <br />
              <a href="mailto:support@fainternationalgrocery.com">support@fainternationalgrocery.com</a>
            </p>
            <p>
              Phone:
              <br />
              <a href="tel:+17016517071">(701) 651-7071</a>
            </p>
            <p>
              Store Address:
              <br />
              413 Main St #103
              <br />
              Williston, ND 58801
              <br />
              United States
            </p>
          </section>

          <section>
            <h2>Store Hours</h2>
            <p>
              Monday-Saturday: 10:00 AM - 9:00 PM
              <br />
              Sunday: 12:00 PM - 9:00 PM
            </p>
          </section>

          <section>
            <h2>Common Support Requests</h2>
            <ul>
              {commonRequests.map((request) => (
                <li key={request}>{request}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2>Response Time</h2>
            <p>
              We aim to respond to all customer inquiries as quickly as possible during business
              hours. Most inquiries receive a response within 24 hours.
            </p>
            <p>
              Thank you for shopping with {storeName}. We appreciate your business and look forward
              to serving you.
            </p>
          </section>
        </div>
      </section>
    </main>
  )
}
