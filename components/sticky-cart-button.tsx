"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"

import { CartItem, readCart } from "@/lib/cart"
import { deliveryStatusForDate } from "@/lib/delivery-status"
import { formatMoney } from "@/lib/format"
import { openCartDrawer } from "@/components/cart-drawer"

export function StickyCartButton() {
  const [items, setItems] = useState<CartItem[]>([])
  const pathname = usePathname()

  useEffect(() => {
    const sync = () => setItems(readCart())
    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("cart-changed", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("cart-changed", sync)
    }
  }, [])

  const count = items.length
  const subtotal = useMemo(() => Math.round(items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0)), [items])
  const status = deliveryStatusForDate()

  useEffect(() => {
    document.body.classList.toggle("has-sticky-cart", items.length > 0)
    return () => document.body.classList.remove("has-sticky-cart")
  }, [items.length])

  if (items.length === 0 || pathname === "/checkout") {
    return null
  }

  return (
    <button
      aria-label={`View cart, ${count} ${count === 1 ? "item" : "items"}, ${formatMoney(subtotal)}, ${status.deliveryLabel}`}
      className="sticky-cart"
      onClick={openCartDrawer}
      type="button"
    >
      <span>View cart</span>
      <strong>{count} {count === 1 ? "item" : "items"}</strong>
      <span>{formatMoney(subtotal)}</span>
    </button>
  )
}
