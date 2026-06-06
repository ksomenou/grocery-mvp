"use client"

import { useEffect, useState } from "react"

import { FulfillmentTimeline } from "@/components/admin-order-workflow"

type FulfillmentStatus =
  | "RECEIVED"
  | "CONFIRMED"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED"

type FulfillmentMethod = "DELIVERY" | "PICKUP"

type OrderStatusSnapshot = {
  fulfillmentMethod: FulfillmentMethod
  isTerminal: boolean
  paymentLabel: string
  paymentStatus: string
  schedule: string
  status: FulfillmentStatus
  statusLabel: string
  updatedAt: string
}

export function CustomerOrderStatus({
  initial,
  orderId,
  token
}: {
  initial: OrderStatusSnapshot
  orderId: string
  token: string
}) {
  const [snapshot, setSnapshot] = useState(initial)

  useEffect(() => {
    if (snapshot.isTerminal) {
      return
    }

    let cancelled = false
    const poll = async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}/status?token=${encodeURIComponent(token)}`, {
          cache: "no-store"
        })
        if (!response.ok) {
          return
        }

        const next = await response.json() as OrderStatusSnapshot
        if (!cancelled) {
          setSnapshot(next)
        }
      } catch {
        // Keep the last known status visible if polling is interrupted.
      }
    }

    const timer = window.setInterval(poll, 12000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [orderId, snapshot.isTerminal, token])

  return (
    <div className="customer-order-status" aria-live="polite">
      <div className="summary-line">
        <span>Order status</span>
        <strong>{snapshot.statusLabel}</strong>
      </div>
      <div className="summary-line">
        <span>Payment status</span>
        <strong>{snapshot.paymentLabel}</strong>
      </div>
      {snapshot.schedule ? (
        <div className="summary-line">
          <span>{snapshot.fulfillmentMethod === "DELIVERY" ? "Scheduled delivery" : "Scheduled pickup"}</span>
          <strong>{snapshot.schedule}</strong>
        </div>
      ) : null}
      <FulfillmentTimeline fulfillmentMethod={snapshot.fulfillmentMethod} status={snapshot.status} />
    </div>
  )
}
