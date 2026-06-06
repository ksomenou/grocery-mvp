import type { Metadata } from "next"

import { CheckoutForm } from "@/components/checkout-form"
import { getCurrentUser } from "@/lib/auth"
import { deliveryFeeCents, formatMoney } from "@/lib/format"
import { storeName } from "@/lib/store"

export const metadata: Metadata = {
  title: "Checkout",
  description: `Choose delivery or pickup and pay securely for your ${storeName} order.`
}

export default async function CheckoutPage() {
  const user = await getCurrentUser()

  return (
    <main className="shell">
      <div className="page-title">
        <h1>Checkout</h1>
        <p>Choose local delivery or pickup, then pay securely with Stripe.</p>
      </div>
      <CheckoutForm
        deliveryFeeCents={deliveryFeeCents()}
        deliveryFeeLabel={formatMoney(deliveryFeeCents())}
        initialEmail={user?.email ?? ""}
        initialName={user?.name ?? ""}
        isLoggedIn={Boolean(user && user.role === "CUSTOMER")}
        stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""}
      />
    </main>
  )
}
