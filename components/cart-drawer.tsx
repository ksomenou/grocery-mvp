"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { CartItem, notifyCart, readCart, writeCart } from "@/lib/cart"
import { deliveryStatusForDate } from "@/lib/delivery-status"
import { calculateTaxCents, formatMoney, formatQuantity, formatUnitPrice } from "@/lib/format"

export function openCartDrawer() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("freshcart-open-cart"))
  }
}

export function peekCartDrawer() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("freshcart-peek-cart"))
  }
}

export function CartDrawer() {
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [changedItemId, setChangedItemId] = useState<string | null>(null)
  const subtotal = useMemo(() => Math.round(items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0)), [items])
  const taxCents = useMemo(
    () => calculateTaxCents(Math.round(items.filter((item) => item.taxable).reduce((sum, item) => sum + item.priceCents * item.quantity, 0))),
    [items]
  )
  const status = deliveryStatusForDate()

  useEffect(() => {
    let peekTimer: number | undefined
    const sync = () => setItems(readCart())
    const open = () => {
      if (peekTimer) {
        window.clearTimeout(peekTimer)
      }
      sync()
      setIsOpen(true)
    }
    const peek = () => {
      sync()
      setIsOpen(true)
      if (peekTimer) {
        window.clearTimeout(peekTimer)
      }
      peekTimer = window.setTimeout(() => setIsOpen(false), 2600)
    }

    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("cart-changed", sync)
    window.addEventListener("freshcart-open-cart", open)
    window.addEventListener("freshcart-peek-cart", peek)
    return () => {
      if (peekTimer) {
        window.clearTimeout(peekTimer)
      }
      window.removeEventListener("storage", sync)
      window.removeEventListener("cart-changed", sync)
      window.removeEventListener("freshcart-open-cart", open)
      window.removeEventListener("freshcart-peek-cart", peek)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [isOpen])

  function updateQuantity(id: string, quantity: number) {
    const next = items
      .map((item) => {
        if (item.id !== id || !Number.isFinite(quantity)) {
          return item
        }

        const normalized = item.saleUnit === "LB" ? Math.round(quantity * 2) / 2 : Math.round(quantity)
        return { ...item, quantity: Math.max(0, Math.min(normalized, item.stock)) }
      })
      .filter((item) => item.quantity > 0)

    setItems(next)
    setChangedItemId(id)
    writeCart(next)
    notifyCart(quantity <= 0 ? "Removed from cart" : "Quantity updated")
    window.setTimeout(() => setChangedItemId((current) => (current === id ? null : current)), 420)
  }

  function removeItem(item: CartItem) {
    const next = items.filter((cartItem) => cartItem.id !== item.id)
    setItems(next)
    writeCart(next)
    notifyCart("Removed from cart")
  }

  return (
    <div className={`cart-drawer-shell ${isOpen ? "open" : ""}`} aria-hidden={!isOpen}>
      <button className="cart-drawer-backdrop" onClick={() => setIsOpen(false)} type="button" />
      <aside className="cart-drawer" aria-label="Mini cart" role="dialog" aria-modal="true">
        <div className="cart-drawer-head">
          <div>
            <p className="cart-summary-kicker">{status.deliveryLabel}</p>
            <h2>Your cart ({items.length})</h2>
          </div>
          <button aria-label="Close cart" className="icon-button" onClick={() => setIsOpen(false)} type="button">×</button>
        </div>
        {items.length === 0 ? (
          <div className="empty-state mini-cart-empty">
            <h3>Your cart is empty</h3>
            <p>Add groceries to start your order.</p>
            <Link className="button secondary" href="/products" onClick={() => setIsOpen(false)}>Continue shopping</Link>
          </div>
        ) : (
          <>
            <div className="mini-cart-items">
              {items.map((item) => {
                const step = item.saleUnit === "LB" ? 0.5 : 1

                return (
                  <div className="mini-cart-row" key={item.id}>
                    <Image alt={item.name} height={68} src={item.imageUrl} width={68} />
                    <div>
                      <Link href={`/products/${item.slug}`} onClick={() => setIsOpen(false)}>{item.name}</Link>
                      <p>{formatUnitPrice(item.priceCents, item.saleUnit)}</p>
                      <div className="mini-cart-item-actions">
                        <div className="mini-cart-qty">
                          <button aria-label={`Decrease ${item.name}`} onClick={() => updateQuantity(item.id, item.quantity - step)} type="button">-</button>
                          <strong className={changedItemId === item.id ? "quantity-bump" : ""}>{formatQuantity(item.quantity, item.saleUnit)}</strong>
                          <button aria-label={`Increase ${item.name}`} disabled={item.quantity + step > item.stock} onClick={() => updateQuantity(item.id, item.quantity + step)} type="button">+</button>
                        </div>
                        <strong>{formatMoney(Math.round(item.priceCents * item.quantity))}</strong>
                      </div>
                      <button className="mini-cart-remove" onClick={() => removeItem(item)} type="button">Remove</button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="cart-drawer-summary">
              <div className="summary-line">
                <span>Subtotal</span>
                <strong>{formatMoney(subtotal)}</strong>
              </div>
              <div className="summary-line">
                <span>Estimated tax</span>
                <strong>{formatMoney(taxCents)}</strong>
              </div>
              <small>Delivery fee calculated at checkout</small>
              <p>{status.deliveryLabel} &bull; {status.pickupLabel}</p>
              <Link className="button" href="/checkout" onClick={() => setIsOpen(false)}>Checkout</Link>
              <Link className="button secondary" href="/cart" onClick={() => setIsOpen(false)}>View cart</Link>
              <button className="button secondary" onClick={() => setIsOpen(false)} type="button">Continue shopping</button>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
