"use client"

import { useMemo, useState, useTransition } from "react"

import { updateOrderStatus, type ActionState } from "@/lib/actions"

type FulfillmentStatus =
  | "RECEIVED"
  | "CONFIRMED"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED"

type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED"
type FulfillmentMethod = "DELIVERY" | "PICKUP"

const emptyState: ActionState = { ok: false, message: "" }

const flow: FulfillmentStatus[] = ["RECEIVED", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "DELIVERED"]

const labels: Record<FulfillmentStatus, string> = {
  RECEIVED: "Received",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY_FOR_PICKUP: "Ready for pickup",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded"
}

const actionLabels: Partial<Record<FulfillmentStatus, string>> = {
  CONFIRMED: "Confirm order",
  PREPARING: "Mark preparing",
  READY_FOR_PICKUP: "Ready for pickup",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancel order"
}

function nextStatuses(status: FulfillmentStatus, paymentStatus: PaymentStatus, method: FulfillmentMethod) {
  if (status === "CANCELLED" || status === "REFUNDED" || status === "DELIVERED") {
    return []
  }

  if (paymentStatus !== "PAID") {
    return ["CANCELLED" as const]
  }

  if (status === "RECEIVED") return ["CONFIRMED", "CANCELLED"] as const
  if (status === "CONFIRMED") return ["PREPARING", "CANCELLED"] as const
  if (status === "PREPARING") return [method === "PICKUP" ? "READY_FOR_PICKUP" : "OUT_FOR_DELIVERY", "CANCELLED"] as const
  if (status === "READY_FOR_PICKUP" || status === "OUT_FOR_DELIVERY") return ["DELIVERED"] as const

  return []
}

function toast(message: string, ok = true) {
  window.dispatchEvent(new CustomEvent("freshcart-toast", { detail: { message, ok } }))
}

function mapsUrl(address?: string | null) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address ?? "")}`
}

export function FulfillmentTimeline({
  fulfillmentMethod,
  status
}: {
  fulfillmentMethod: FulfillmentMethod
  status: FulfillmentStatus
}) {
  const steps = fulfillmentMethod === "DELIVERY"
    ? (["RECEIVED", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"] as FulfillmentStatus[])
    : flow
  const activeIndex = steps.indexOf(status)
  const isTerminal = status === "CANCELLED" || status === "REFUNDED"

  return (
    <div className={`fulfillment-timeline ${isTerminal ? "terminal" : ""}`} aria-label="Fulfillment progress">
      {steps.map((step, index) => (
        <span className={index <= activeIndex && !isTerminal ? "active" : ""} key={step}>
          <i aria-hidden="true" />
          <small>{step === "READY_FOR_PICKUP" ? "Ready" : labels[step].replace("Out for delivery", "Out")}</small>
        </span>
      ))}
      {isTerminal ? <strong>{labels[status]}</strong> : null}
    </div>
  )
}

export function OrderWorkflowActions({
  address,
  className = "",
  fulfillmentMethod,
  orderId,
  paymentStatus,
  phone,
  status
}: {
  address?: string | null
  className?: string
  fulfillmentMethod: FulfillmentMethod
  orderId: string
  paymentStatus: PaymentStatus
  phone?: string | null
  status: FulfillmentStatus
}) {
  const [currentStatus, setCurrentStatus] = useState(status)
  const [pendingStatus, setPendingStatus] = useState<FulfillmentStatus | null>(null)
  const [isPending, startTransition] = useTransition()
  const actions = useMemo(() => nextStatuses(currentStatus, paymentStatus, fulfillmentMethod), [currentStatus, fulfillmentMethod, paymentStatus])

  function updateStatus(next: FulfillmentStatus) {
    if (next === "CANCELLED" && !window.confirm("Cancel this order?")) {
      return
    }

    const previous = currentStatus
    const formData = new FormData()
    formData.set("status", next)
    setCurrentStatus(next)
    setPendingStatus(next)

    startTransition(async () => {
      const result = await updateOrderStatus(orderId, emptyState, formData)
      setPendingStatus(null)
      if (!result.ok) {
        setCurrentStatus(previous)
        toast(result.message || "Could not update order.", false)
        return
      }

      toast(result.message || "Order status updated.")
    })
  }

  async function copyAddress() {
    if (!address) return
    await navigator.clipboard.writeText(address)
    toast("Address copied.")
  }

  return (
    <div className={`order-workflow ${className}`}>
      <FulfillmentTimeline fulfillmentMethod={fulfillmentMethod} status={currentStatus} />
      {paymentStatus !== "PAID" && currentStatus !== "CANCELLED" ? (
        <p className="order-helper-text">Payment must be paid before fulfillment can begin.</p>
      ) : null}
      <div className="order-workflow-actions">
        {actions.map((next) => (
          <button
            className={`button ${next === "CANCELLED" ? "yellow" : "secondary"}`}
            disabled={isPending}
            key={next}
            onClick={() => updateStatus(next)}
            type="button"
          >
            {pendingStatus === next ? <><span className="button-spinner" aria-hidden="true" />Updating...</> : actionLabels[next]}
          </button>
        ))}
      </div>
      <div className="mobile-order-tools">
        {phone ? <a className="button secondary" href={`tel:${phone}`}>Call customer</a> : null}
        {phone ? <a className="button secondary" href={`sms:${phone}`}>SMS customer</a> : null}
        {address ? <button className="button secondary" onClick={copyAddress} type="button">Copy address</button> : null}
        {address ? <a className="button secondary" href={mapsUrl(address)} rel="noreferrer" target="_blank">Open maps</a> : null}
      </div>
    </div>
  )
}
