import type { Metadata } from "next"

import { CartView } from "@/components/cart-view"
import { storeName } from "@/lib/store"

export const metadata: Metadata = {
  title: "Cart",
  description: `Review your ${storeName} grocery basket before delivery or pickup checkout.`
}

export default function CartPage() {
  return (
    <main className="shell cart-page">
      <div className="page-title">
        <h1>Your cart</h1>
        <p>Review your basket before entering a local delivery address.</p>
      </div>
      <CartView />
    </main>
  )
}
