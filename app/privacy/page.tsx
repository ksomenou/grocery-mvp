import { storeName } from "@/lib/store"

export const metadata = {
  title: "Privacy Policy"
}

const policySections = [
  {
    title: "1. Information We Collect",
    body: "When you place an order, create an account, or contact us, we may collect:",
    items: [
      "Name",
      "Email address",
      "Phone number",
      "Delivery or billing address",
      "Payment information (processed securely through Stripe or other payment providers)",
      "Order history"
    ],
    note: "We may also collect technical information such as IP address, browser type, device information, and website usage data."
  },
  {
    title: "2. How We Use Your Information",
    body: "We use your information to:",
    items: [
      "Process and fulfill orders",
      "Arrange delivery or pickup",
      "Communicate about your orders",
      "Send order confirmations and service-related emails",
      "Respond to customer service requests",
      "Improve our website and services",
      "Prevent fraud and unauthorized transactions"
    ]
  },
  {
    title: "3. Payment Processing",
    body: "We do not store credit card or payment card information on our servers.",
    note: "Payments are securely processed by trusted third-party payment providers such as Stripe. Their use of your information is governed by their own privacy policies."
  },
  {
    title: "4. Sharing Information",
    body: "We do not sell, rent, or trade your personal information.",
    note: "We may share information only with payment processors, delivery providers, service providers that help operate our business, and government authorities when required by law."
  },
  {
    title: "5. Data Security",
    body: "We take reasonable measures to protect your personal information from unauthorized access, disclosure, alteration, or destruction.",
    note: "However, no method of transmission over the Internet or electronic storage is completely secure, and we cannot guarantee absolute security."
  },
  {
    title: "6. Cookies",
    body: "Our website may use cookies and similar technologies to:",
    items: [
      "Remember your preferences",
      "Keep items in your shopping cart",
      "Improve website performance",
      "Analyze website traffic",
      "Enhance your shopping experience"
    ],
    note: "You may disable cookies through your browser settings, though some website features may not function properly."
  },
  {
    title: "7. Your Rights",
    body: "Depending on your location, you may have the right to:",
    items: [
      "Access your personal information",
      "Request corrections to inaccurate information",
      "Request deletion of your information",
      "Opt out of certain communications"
    ],
    note: "To make a request, please contact us."
  },
  {
    title: "8. Children's Privacy",
    body: "Our website is not intended for children under 13 years of age. We do not knowingly collect personal information from children."
  },
  {
    title: "9. Changes to This Policy",
    body: "We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated revision date."
  }
]

export default function PrivacyPage() {
  return (
    <main className="shell">
      <section className="panel policy-panel">
        <p className="admin-kicker">Last Updated: June 4, 2026</p>
        <h1>Privacy Policy</h1>
        <p className="muted">
          Welcome to {storeName}. Your privacy is important to us. This Privacy Policy explains
          how we collect, use, and protect your information when you use our website.
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
            <h2>10. Contact Us</h2>
            <p>
              <strong>{storeName}</strong>
              <br />
              Email: <a href="mailto:support@fainternationalgrocery.com">support@fainternationalgrocery.com</a>
              <br />
              Phone: <a href="tel:+17016517071">(701) 651-7071</a>
              <br />
              Address:
              <br />
              413 Main St #103
              <br />
              Williston, ND 58801
              <br />
              United States
            </p>
          </section>
        </div>
      </section>
    </main>
  )
}
