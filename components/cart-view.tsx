"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useMemo, useState } from "react"

import { CartItem, notifyCart, readCart, writeCart } from "@/lib/cart"
import { calculateTaxCents, deliveryEstimateForCart, formatMoney, formatQuantity, formatUnitPrice, freeDeliveryThresholdCents } from "@/lib/format"

export function CartView() {
  const [items, setItems] = useState<CartItem[]>([])
  const [isReady, setIsReady] = useState(false)
  const [cartEmail, setCartEmail] = useState("")
  const [cartSyncMessage, setCartSyncMessage] = useState("")

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setItems(readCart())
      setIsReady(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const subtotal = useMemo(() => Math.round(items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0)), [items])
  const originalSubtotal = useMemo(
    () => Math.round(items.reduce((sum, item) => sum + (item.originalPriceCents ?? item.priceCents) * item.quantity, 0)),
    [items]
  )
  const savings = Math.max(0, originalSubtotal - subtotal)
  const taxCents = useMemo(
    () => calculateTaxCents(Math.round(items.filter((item) => item.taxable).reduce((sum, item) => sum + item.priceCents * item.quantity, 0))),
    [items]
  )
  const hasFreeDelivery = subtotal >= freeDeliveryThresholdCents()
  const itemCount = items.length
  const deliveryEstimate = deliveryEstimateForCart(itemCount)
  const freeDeliveryRemaining = Math.max(0, freeDeliveryThresholdCents() - subtotal)
  const hasInvalidItems = useMemo(
    () => items.some((item) => item.stock <= 0 || item.quantity > item.stock),
    [items]
  )

  function updateQuantity(id: string, quantity: number) {
    if (!Number.isFinite(quantity)) {
      return
    }

    const next = items
      .map((item) => {
        if (item.id !== id) {
          return item
        }

        const normalized = item.saleUnit === "LB" ? Math.round(quantity * 2) / 2 : Math.round(quantity)
        return { ...item, quantity: Math.max(0, Math.min(normalized, item.stock)) }
      })
      .filter((item) => item.quantity > 0)
    setItems(next)
    writeCart(next)
    notifyCart(quantity <= 0 ? "Removed from cart" : "Quantity updated")
  }

  function removeItem(id: string) {
    const next = items.filter((item) => item.id !== id)
    setItems(next)
    writeCart(next)
    notifyCart("Removed from cart")
  }

  async function savePersistentCart() {
    setCartSyncMessage("")
    const response = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cartEmail, items })
    })

    if (!response.ok) {
      setCartSyncMessage("Enter a valid email to save your cart.")
      return
    }

    notifyCart("Cart saved")
    setCartSyncMessage("Cart saved for later.")
  }

  async function loadPersistentCart() {
    setCartSyncMessage("")
    const response = await fetch(`/api/cart?email=${encodeURIComponent(cartEmail)}`)
    const data = await response.json()
    const next = Array.isArray(data.items) ? data.items : []
    setItems(next)
    writeCart(next)
    notifyCart(next.length > 0 ? "Saved cart loaded" : "No saved cart found")
    setCartSyncMessage(next.length > 0 ? "Saved cart loaded." : "No saved cart found for that email.")
  }

  if (!isReady) {
    return (
      <div className="two-col">
        <section className="panel cart-loading">
          <div className="skeleton-row" />
          <div className="skeleton-row" />
        </section>
        <aside className="panel">
          <div className="skeleton-line wide" />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </aside>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <section className="panel empty-state">
        <h3>Your cart is empty</h3>
        <p className="muted">Looks like your basket is empty.</p>
        <Link className="button" href="/products">Browse products</Link>
      </section>
    )
  }

  return (
    <div className="two-col">
      <section className="panel">
        {items.map((item) => (
          <div className="cart-row" key={item.id}>
            <Image alt={item.name} height={72} src={item.imageUrl} width={72} />
            <div className="cart-row-body">
              <div className="cart-row-head">
                <strong>{item.name}</strong>
                {item.discountBadge && item.originalPriceCents && item.originalPriceCents > item.priceCents ? (
                  <span className="cart-discount-badge">{item.discountBadge}</span>
                ) : null}
              </div>
              <div className="price-row" style={{ marginTop: 8 }}>
                <span className="price-stack cart-price-stack">
                  {item.originalPriceCents && item.originalPriceCents > item.priceCents ? (
                    <span className="original-price">{formatUnitPrice(item.originalPriceCents, item.saleUnit)}</span>
                  ) : null}
                  <span>{formatUnitPrice(item.priceCents, item.saleUnit)}</span>
                </span>
                <div className="quantity">
                  <button aria-label={`Decrease ${item.name}`} onClick={() => updateQuantity(item.id, item.quantity - (item.saleUnit === "LB" ? 0.5 : 1))} type="button">-</button>
                  <input
                    aria-label={`${item.name} quantity`}
                    min={item.saleUnit === "LB" ? 0.5 : 1}
                    onChange={(event) => updateQuantity(item.id, Number(event.target.value))}
                    step={item.saleUnit === "LB" ? 0.5 : 1}
                    type="number"
                    value={item.quantity}
                  />
                  <span>{item.saleUnit === "LB" ? "lb" : ""}</span>
                  <button
                    aria-label={`Increase ${item.name}`}
                    disabled={item.quantity + (item.saleUnit === "LB" ? 0.5 : 1) > item.stock}
                    onClick={() => updateQuantity(item.id, item.quantity + (item.saleUnit === "LB" ? 0.5 : 1))}
                    type="button"
                  >
                    +
                  </button>
                </div>
              </div>
              {item.quantity + (item.saleUnit === "LB" ? 0.5 : 1) > item.stock ? (
                <p className="cart-stock-note">Max stock reached</p>
              ) : null}
              <p className="muted" style={{ margin: "8px 0 0" }}>
                {formatQuantity(item.quantity, item.saleUnit)} x {formatUnitPrice(item.priceCents, item.saleUnit)} = {formatMoney(Math.round(item.priceCents * item.quantity))}
              </p>
              <button className="cart-remove" onClick={() => removeItem(item.id)} type="button">Remove</button>
            </div>
          </div>
        ))}
      </section>
      <aside className="panel">
        <p className="cart-summary-kicker">Estimated delivery {deliveryEstimate}</p>
        <p className="cart-summary-kicker">Pickup available</p>
        <p className={`free-delivery-note ${hasFreeDelivery ? "unlocked" : ""}`}>
          {hasFreeDelivery ? "Free delivery unlocked" : "Free delivery on orders $100+"}
        </p>
        {!hasFreeDelivery ? <p className="cart-upsell-note">Add for {formatMoney(freeDeliveryRemaining)} more to unlock free delivery.</p> : null}
        <div className="summary-line">
          <span>Items</span>
          <strong>{itemCount} {itemCount === 1 ? "item" : "items"}</strong>
        </div>
        {savings > 0 ? (
          <>
            <div className="summary-line">
              <span>Original subtotal</span>
              <strong>{formatMoney(originalSubtotal)}</strong>
            </div>
            <div className="summary-line savings">
              <span>Savings</span>
              <strong>-{formatMoney(savings)}</strong>
            </div>
          </>
        ) : null}
        <div className="summary-line">
          <span>Subtotal</span>
          <strong>{formatMoney(subtotal)}</strong>
        </div>
        <div className="summary-line">
          <span>Estimated tax</span>
          <strong>{formatMoney(taxCents)}</strong>
        </div>
        <p className="muted">Delivery fee is calculated at checkout for simple local delivery.</p>
        {hasInvalidItems ? (
          <>
            <p className="form-note warning">Adjust or remove out-of-stock items before checkout.</p>
            <button className="button" disabled style={{ marginTop: 12, width: "100%" }} type="button">Checkout</button>
          </>
        ) : (
          <Link className="button" href="/checkout" style={{ marginTop: 12, width: "100%" }}>Checkout</Link>
        )}
        <p className="cart-trust-text">🔒 Secure checkout · Stripe protected</p>
        <div className="saved-cart-box">
          <label className="form-field">
            <span>Save or load cart</span>
            <input
              className="field"
              onChange={(event) => setCartEmail(event.target.value)}
              placeholder="Email address"
              type="email"
              value={cartEmail}
            />
          </label>
          <div className="saved-cart-actions">
            <button className="button secondary" onClick={savePersistentCart} type="button">Save cart</button>
            <button className="button secondary" onClick={loadPersistentCart} type="button">Load cart</button>
          </div>
          {cartSyncMessage ? <p className="muted">{cartSyncMessage}</p> : null}
        </div>
      </aside>
    </div>
  )
}
