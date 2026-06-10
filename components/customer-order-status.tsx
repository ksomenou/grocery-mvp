"use client"

import { useEffect, useState } from "react"

type FulfillmentStatus =
  | "RECEIVED"
  | "CONFIRMED"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "PARTIALLY_REFUNDED"
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

function customerOrderStatusLabel(status: FulfillmentStatus) {
  if (status === "CANCELLED") return "Order cancelled"
  if (status === "PARTIALLY_REFUNDED") return "Partial refund processed"
  if (status === "REFUNDED") return "Order refunded"
  if (status === "DELIVERED") return "Completed"
  if (status === "PREPARING") return "Preparing"
  if (status === "READY_FOR_PICKUP") return "Ready for pickup"
  if (status === "OUT_FOR_DELIVERY") return "Out for delivery"
  return "Order received"
}

function customerPaymentStatusLabel(status: string, fulfillmentMethod: FulfillmentMethod) {
  if (status === "PAID") return "Paid"
  if (status === "FAILED") return "Payment failed"
  if (status === "REFUNDED") return "Refunded"
  if (fulfillmentMethod === "PICKUP") return "Payment due at pickup"
  return "Payment pending"
}

function progressIndex(status: FulfillmentStatus) {
  if (status === "DELIVERED") return 3
  if (status === "READY_FOR_PICKUP" || status === "OUT_FOR_DELIVERY") return 2
  if (status === "PREPARING") return 1
  if (status === "CANCELLED" || status === "PARTIALLY_REFUNDED" || status === "REFUNDED") return -1
  return 0
}

function CustomerProgressCard({
  fulfillmentMethod,
  status
}: {
  fulfillmentMethod: FulfillmentMethod
  status: FulfillmentStatus
}) {
  const steps = [
    "Order received",
    "Preparing",
    fulfillmentMethod === "DELIVERY" ? "Out for delivery" : "Ready for pickup",
    "Completed"
  ]
  const activeIndex = progressIndex(status)

  return (
    <div className="customer-progress-card" aria-label="Order progress">
      {activeIndex < 0 ? (
        <p>Your order is no longer in active preparation. Please contact us if you need help with this order.</p>
      ) : (
        steps.map((step, index) => (
          <div className={index <= activeIndex ? "active" : ""} key={step}>
            <span>{index + 1}</span>
            <strong>{step}</strong>
          </div>
        ))
      )}
    </div>
  )
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
        <strong>{customerOrderStatusLabel(snapshot.status)}</strong>
      </div>
      <div className="summary-line">
        <span>Payment status</span>
        <strong>{customerPaymentStatusLabel(snapshot.paymentStatus, snapshot.fulfillmentMethod)}</strong>
      </div>
      {snapshot.schedule ? (
        <div className="summary-line">
          <span>{snapshot.fulfillmentMethod === "DELIVERY" ? "Scheduled delivery" : "Scheduled pickup"}</span>
          <strong>{snapshot.schedule}</strong>
        </div>
      ) : null}
      <CustomerProgressCard fulfillmentMethod={snapshot.fulfillmentMethod} status={snapshot.status} />
    </div>
  )
}
