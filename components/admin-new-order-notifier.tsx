"use client"

import { useEffect, useRef, useState } from "react"

type NotificationPayload = {
  latestOrderId: string | null
  latestOrderLabel: string | null
}

export function AdminNewOrderNotifier({ initialOrderId }: { initialOrderId: string | null }) {
  const [banner, setBanner] = useState<string | null>(null)
  const lastSeenRef = useRef(initialOrderId)

  useEffect(() => {
    let cancelled = false

    async function checkOrders() {
      try {
        const response = await fetch("/api/admin/order-notifications", { cache: "no-store" })
        if (!response.ok) return
        const data = (await response.json()) as NotificationPayload
        if (cancelled || !data.latestOrderId) return

        if (lastSeenRef.current && data.latestOrderId !== lastSeenRef.current) {
          const message = data.latestOrderLabel ?? "New order received"
          setBanner(message)
          window.dispatchEvent(new CustomEvent("freshcart-toast", { detail: { message } }))

          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("New order received", { body: message })
          } else if ("Notification" in window && Notification.permission === "default") {
            void Notification.requestPermission()
          }
        }

        lastSeenRef.current = data.latestOrderId
      } catch {
        // Polling should never interrupt the admin dashboard.
      }
    }

    const timer = window.setInterval(checkOrders, 30000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  if (!banner) {
    return null
  }

  return (
    <div className="new-order-banner" role="status">
      <span>{banner}</span>
      <button onClick={() => setBanner(null)} type="button">Dismiss</button>
    </div>
  )
}
