"use client"

import { useEffect, useState } from "react"

import { peekCartDrawer } from "@/components/cart-drawer"
import { CartItem, notifyCart, readCart, writeCart } from "@/lib/cart"
import { formatQuantity } from "@/lib/format"

export function ProductDetailCartControl({ product }: { product: Omit<CartItem, "quantity"> }) {
  const step = product.saleUnit === "LB" ? 0.5 : 1
  const minQuantity = Math.min(step, product.stock)
  const [quantity, setQuantity] = useState(minQuantity)
  const [justAdded, setJustAdded] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    const sync = () => {
      const current = readCart().find((item) => item.id === product.id)
      setQuantity(current?.quantity ?? minQuantity)
    }

    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("cart-changed", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("cart-changed", sync)
    }
  }, [minQuantity, product.id])

  function setSafeQuantity(nextQuantity: number) {
    if (!Number.isFinite(nextQuantity)) {
      return
    }

    const normalized = product.saleUnit === "LB" ? Math.round(nextQuantity * 2) / 2 : Math.round(nextQuantity)
    setQuantity(Math.max(minQuantity, Math.min(normalized, product.stock)))
  }

  function addToCart() {
    if (product.stock <= 0 || isUpdating) {
      return
    }

    setIsUpdating(true)
    const cart = readCart()
    const existing = cart.find((item) => item.id === product.id)
    const next = existing
      ? cart.map((item) => (item.id === product.id ? { ...item, quantity } : item))
      : [...cart, { ...product, quantity }]

    writeCart(next)
    setJustAdded(true)
    notifyCart(existing ? "Quantity updated" : "Added to cart")
    peekCartDrawer()
    window.setTimeout(() => setJustAdded(false), 900)
    window.setTimeout(() => {
      setIsUpdating(false)
    }, 300)
  }

  if (product.stock <= 0) {
    return (
      <div className="detail-cart-control">
        <button className="button" disabled type="button">
          Out of stock
        </button>
      </div>
    )
  }

  return (
    <div className="detail-cart-control">
      <div className="detail-quantity" aria-label={`${product.name} quantity selector`}>
        <button
          aria-label={`Decrease ${product.name}`}
          disabled={quantity - step < minQuantity}
          onClick={() => setSafeQuantity(quantity - step)}
          type="button"
        >
          -
        </button>
        <strong>{formatQuantity(quantity, product.saleUnit)}</strong>
        <button
          aria-label={`Increase ${product.name}`}
          disabled={quantity + step > product.stock}
          onClick={() => setSafeQuantity(quantity + step)}
          type="button"
        >
          +
        </button>
      </div>
      {product.saleUnit === "LB" ? <p className="detail-quantity-note">Adjusts by 0.5 lb</p> : null}
      <button
        className={`button detail-add-button add-confirm-button ${justAdded ? "confirmed" : ""}`}
        disabled={product.stock <= 0 || isUpdating}
        onClick={addToCart}
        type="button"
      >
        {justAdded ? "Added to cart" : "Add to cart"}
      </button>
    </div>
  )
}
