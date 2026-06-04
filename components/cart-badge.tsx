"use client"

import { useEffect, useRef, useState } from "react"

import { readCart } from "@/lib/cart"
import { openCartDrawer } from "@/components/cart-drawer"

export function CartBadge() {
  const [count, setCount] = useState(0)
  const [bumped, setBumped] = useState(false)
  const touchHandledRef = useRef(false)

  useEffect(() => {
    const sync = () => {
      setCount(readCart().length)
      setBumped(true)
      window.setTimeout(() => setBumped(false), 220)
    }

    sync()
    window.addEventListener("storage", sync)
    window.addEventListener("cart-changed", sync)
    return () => {
      window.removeEventListener("storage", sync)
      window.removeEventListener("cart-changed", sync)
    }
  }, [])

  function activateCart() {
    openCartDrawer()
  }

  function activateCartFromTouch() {
    touchHandledRef.current = true
    activateCart()
    window.setTimeout(() => {
      touchHandledRef.current = false
    }, 350)
  }

  return (
    <button
      className={`icon-button cart-icon ${bumped ? "bump" : ""}`}
      onClick={() => {
        if (!touchHandledRef.current) {
          activateCart()
        }
      }}
      onTouchEnd={activateCartFromTouch}
      type="button"
      aria-label="Open cart"
    >
      <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 24 24" width="22">
        <path d="M6.5 9.5h11l-1 9h-9l-1-9Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        <path d="M9 9.5a3 3 0 0 1 6 0" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
      {count > 0 ? <span className="badge" style={{ position: "absolute", right: -8, top: -8 }}>{count}</span> : null}
    </button>
  )
}
