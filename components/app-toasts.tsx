"use client"

import { useEffect, useState } from "react"

type Toast = {
  id: number
  message: string
}

export function AppToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    function showToast(event: Event) {
      const message = event instanceof CustomEvent ? String(event.detail?.message ?? "") : ""
      if (!message) {
        return
      }

      const id = Date.now()
      setToasts((current) => [...current.slice(-2), { id, message }])
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id))
      }, 2200)
    }

    window.addEventListener("freshcart-toast", showToast)
    return () => window.removeEventListener("freshcart-toast", showToast)
  }, [])

  return (
    <div className="app-toasts" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div className="app-toast" key={toast.id}>{toast.message}</div>
      ))}
    </div>
  )
}
