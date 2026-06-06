import { storeName } from "@/lib/store"

export const metadata = {
  title: "Terms and Conditions"
}

const termsSections = [
  {
    title: "1. General",
    body: `${storeName} provides grocery products for purchase through our website for local delivery and pickup. We reserve the right to update, modify, or discontinue any part of our services at any time without prior notice.`
  },
  {
    title: "2. Orders",
    body: "By placing an order, you agree that:",
    items: [
      "All information provided is accurate and complete.",
      "You are authorized to use the payment method provided.",
      "Your order is subject to product availability.",
      "We reserve the right to refuse or cancel any order for any reason."
    ],
    note: "If an item becomes unavailable after an order is placed, we may contact you regarding a replacement, adjustment, or refund."
  },
  {
    title: "3. Pricing and Payments",
    items: [
      "All prices are listed in U.S. Dollars (USD).",
      "Prices are subject to change without notice.",
      "Applicable taxes and fees will be calculated at checkout.",
      "Payment must be completed before an order is processed."
    ],
    note: "We use secure third-party payment processors to handle payment transactions."
  },
  {
    title: "4. Delivery and Pickup",
    body: "Delivery",
    items: [
      "Delivery is available only within designated service areas.",
      "Delivery times are estimates and are not guaranteed.",
      "Delays may occur due to weather, traffic, inventory issues, or circumstances beyond our control."
    ],
    note: "Pickup: Customers are responsible for picking up orders during business hours. Orders not picked up within a reasonable timeframe may be canceled."
  },
  {
    title: "5. Product Information",
    body: "We make every effort to ensure product descriptions, images, and prices are accurate. However:",
    items: [
      "Product packaging may vary from images shown.",
      "Pricing errors may occasionally occur.",
      "Availability may change without notice."
    ],
    note: "We reserve the right to correct any errors at any time."
  },
  {
    title: "6. Refunds and Returns",
    body: "Refunds and returns are governed by our Refund Policy.",
    note: "Perishable items, fresh produce, meat, seafood, frozen products, and other food products may not be eligible for return unless the item is damaged, defective, or incorrect."
  },
  {
    title: "7. Account Responsibility",
    body: "If you create an account on our website, you are responsible for:",
    items: [
      "Maintaining the confidentiality of your account credentials.",
      "Restricting access to your account.",
      "All activities that occur under your account."
    ],
    note: "Please notify us immediately if you suspect unauthorized access."
  },
  {
    title: "8. Prohibited Uses",
    body: "You agree not to:",
    items: [
      "Use the website for unlawful purposes.",
      "Attempt to interfere with website operations.",
      "Upload malicious code or harmful content.",
      "Access restricted areas without authorization.",
      "Use automated systems to collect data from the website."
    ]
  },
  {
    title: "9. Limitation of Liability",
    body: `To the fullest extent permitted by law, ${storeName} shall not be liable for any indirect, incidental, special, or consequential damages arising from:`,
    items: [
      "Use of the website",
      "Product availability issues",
      "Delivery delays",
      "Service interruptions",
      "Errors or omissions on the website"
    ],
    note: "Our total liability shall not exceed the amount paid for the affected order."
  },
  {
    title: "10. Intellectual Property",
    body: `All website content, including text, logos, images, graphics, and design elements, is the property of ${storeName} and may not be copied, reproduced, or distributed without written permission.`
  },
  {
    title: "11. Privacy",
    body: "Your use of our website is also governed by our Privacy Policy, which explains how we collect and use your information."
  },
  {
    title: "12. Changes to These Terms",
    body: "We reserve the right to modify these Terms and Conditions at any time. Updated versions will be posted on this page with a revised effective date."
  }
]

export default function TermsPage() {
  return (
    <main className="shell">
      <section className="panel policy-panel">
        <p className="admin-kicker">Last Updated: June 4, 2026</p>
        <h1>Terms and Conditions</h1>
        <p className="muted">
          Welcome to {storeName}. By accessing or using our website, placing an order, or using
          any of our services, you agree to be bound by these Terms and Conditions.
        </p>

        <div className="policy-sections">
          {termsSections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.body ? <p>{section.body}</p> : null}
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
            <h2>13. Contact Us</h2>
            <p>If you have any questions regarding these Terms and Conditions, please contact us:</p>
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
            <p>
              Thank you for choosing {storeName}. We appreciate your business and look forward to
              serving you.
            </p>
          </section>
        </div>
      </section>
    </main>
  )
}
