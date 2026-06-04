"use client"

import { useSyncExternalStore } from "react"

import { deliveryAvailabilityMessage } from "@/lib/delivery-status"

const zipStorageKey = "freshcart-delivery-zip"
const zipChangedEvent = "freshcart-delivery-zip-changed"

function subscribeToZip(callback: () => void) {
  window.addEventListener("storage", callback)
  window.addEventListener(zipChangedEvent, callback)

  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener(zipChangedEvent, callback)
  }
}

function getZipSnapshot() {
  return window.localStorage.getItem(zipStorageKey) ?? ""
}

function getServerZipSnapshot() {
  return ""
}

export function DeliveryZipSelector() {
  const zipCode = useSyncExternalStore(subscribeToZip, getZipSnapshot, getServerZipSnapshot)

  function updateZip(value: string) {
    const next = value.replace(/[^\d]/g, "").slice(0, 5)
    window.localStorage.setItem(zipStorageKey, next)
    window.dispatchEvent(new Event(zipChangedEvent))
  }

  return (
    <label className="zip-selector">
      <span>{zipCode.length === 5 ? "Delivering to" : "Deliver to"}</span>
      <input
        aria-label="Delivery ZIP code"
        inputMode="numeric"
        onChange={(event) => updateZip(event.target.value)}
        placeholder="ZIP"
        value={zipCode}
      />
      <small>{deliveryAvailabilityMessage(zipCode)}</small>
    </label>
  )
}
