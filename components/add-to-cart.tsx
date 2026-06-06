"use client"

import { useEffect, useRef, useState } from "react"

import { peekCartDrawer } from "@/components/cart-drawer"
import { CartItem, notifyCart, readCart, writeCart } from "@/lib/cart"
import { formatMoney, formatQuantity } from "@/lib/format"

export function AddToCartButton({ product }: { product: Omit<CartItem, "quantity"> }) {
  const [quantity, setQuantity] = useState(0)
  const [justAdded, setJustAdded] = useState(false)
  const touchHandledRef = useRef(false)
  const step = product.saleUnit === "LB" ? 0.5 : 1

  useEffect(() => {
    const sync = () => {
      const current = readCart().find((item) => item.id === product.id)
      setQuantity(current?.quantity ?? 0)
    }

    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("cart-changed", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("cart-changed", sync)
    }
  }, [product.id])

  function update(nextQuantity: number) {
    if (!Number.isFinite(nextQuantity)) {
      return
    }

    const cart = readCart()
    const existing = cart.find((item) => item.id === product.id)
    const normalized = product.saleUnit === "LB" ? Math.round(nextQuantity * 2) / 2 : Math.round(nextQuantity)
    const clamped = Math.max(0, Math.min(normalized, product.stock))
    const next = existing
      ? cart
          .map((item) => (item.id === product.id ? { ...item, quantity: clamped } : item))
          .filter((item) => item.quantity > 0)
      : clamped > 0
        ? [...cart, { ...product, quantity: clamped }]
        : cart

    writeCart(next)
    setJustAdded(true)
    notifyCart(existing ? "Quantity updated" : "Added to cart")
    if (clamped > 0 && nextQuantity > quantity) {
      peekCartDrawer()
    }
    window.setTimeout(() => setJustAdded(false), 850)
  }

  function updateFromClick(nextQuantity: number) {
    if (!touchHandledRef.current) {
      update(nextQuantity)
    }
  }

  function updateFromTouch(nextQuantity: number) {
    touchHandledRef.current = true
    update(nextQuantity)
    window.setTimeout(() => {
      touchHandledRef.current = false
    }, 350)
  }

  if (product.stock <= 0) {
    return (
      <button className="button" disabled type="button">
        Out of stock
      </button>
    )
  }

  if (quantity > 0) {
    return (
      <div className={`product-quantity ${justAdded ? "confirmed" : ""}`}>
        <button
          aria-label={`Decrease ${product.name}`}
          onClick={() => updateFromClick(quantity - step)}
          onTouchEnd={() => updateFromTouch(quantity - step)}
          type="button"
        >
          -
        </button>
        <strong>{formatQuantity(quantity, product.saleUnit)}</strong>
        <button
          aria-label={`Increase ${product.name}`}
          disabled={quantity + step > product.stock}
          onClick={() => updateFromClick(quantity + step)}
          onTouchEnd={() => updateFromTouch(quantity + step)}
          type="button"
        >
          +
        </button>
        <span>{formatMoney(product.priceCents * quantity)}</span>
      </div>
    )
  }

  return (
    <button
      className={`button add-confirm-button ${justAdded ? "confirmed" : ""}`}
      onClick={() => updateFromClick(Math.min(1, product.stock))}
      onTouchEnd={() => updateFromTouch(Math.min(1, product.stock))}
      type="button"
    >
      {justAdded ? "Added" : "🛒 Add to cart"}
    </button>
  )
}
