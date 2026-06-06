"use client"

import { useEffect } from "react"

import { clearCart } from "@/lib/cart"

const clearCartFlag = "freshcart-clear-cart-on-confirmation"

export function markCartForConfirmationClear() {
  window.sessionStorage.setItem(clearCartFlag, "1")
}

export function clearConfirmationCartFlag() {
  window.sessionStorage.removeItem(clearCartFlag)
}

export function ClearCartOnConfirmation() {
  useEffect(() => {
    if (window.sessionStorage.getItem(clearCartFlag) !== "1") {
      return
    }

    clearCart()
    window.sessionStorage.removeItem(clearCartFlag)
  }, [])

  return null
}
