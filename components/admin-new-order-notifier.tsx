"use client"

import { useEffect, useRef, useState } from "react"

type NotificationPayload = {
  latestOrderId: string | null
  latestOrderLabel: string | null
}

type AdminSessionPayload = {
  isAdmin: boolean
}

export function AdminNewOrderNotifier({ initialOrderId }: { initialOrderId: string | null }) {
  const [banner, setBanner] = useState<string | null>(null)
  const lastSeenRef = useRef(initialOrderId)

  useEffect(() => {
    let cancelled = false
    let pollingAllowed = false
    let timer: number | null = null

    async function fetchWithTimeout(input: string) {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 5000)

      try {
        return await fetch(input, {
          cache: "no-store",
          signal: controller.signal
        })
      } finally {
        window.clearTimeout(timeout)
      }
    }

    async function confirmAdminSession() {
      try {
        const response = await fetchWithTimeout("/api/admin/session")
        if (!response.ok) return
        const data = (await response.json()) as AdminSessionPayload
        pollingAllowed = data.isAdmin
        if (!data.isAdmin && timer !== null) {
          window.clearInterval(timer)
          timer = null
        }
      } catch {
        // Auth probing should never interrupt the admin dashboard.
      }
    }

    async function checkOrders() {
      if (!pollingAllowed || document.visibilityState !== "visible") {
        return
      }

      try {
        const sessionResponse = await fetchWithTimeout("/api/admin/session")
        if (!sessionResponse.ok) return
        const session = (await sessionResponse.json()) as AdminSessionPayload
        if (!session.isAdmin) {
          pollingAllowed = false
          if (timer !== null) {
            window.clearInterval(timer)
            timer = null
          }
          return
        }

        const response = await fetchWithTimeout("/api/admin/order-notifications")
        if (!response.ok) {
          if (response.status === 401 && timer !== null) {
            pollingAllowed = false
            window.clearInterval(timer)
            timer = null
          }
          return
        }
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

    function stopPolling() {
      pollingAllowed = false
      if (timer !== null) {
        window.clearInterval(timer)
        timer = null
      }
    }

    void confirmAdminSession().then(() => {
      if (!cancelled && pollingAllowed) {
        timer = window.setInterval(checkOrders, 60000)
      }
    })
    window.addEventListener("freshcart-admin-logout", stopPolling)

    return () => {
      cancelled = true
      stopPolling()
      window.removeEventListener("freshcart-admin-logout", stopPolling)
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
