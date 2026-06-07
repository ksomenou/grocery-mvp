import Link from "next/link"
import type { Metadata } from "next"

import { ClearCartOnConfirmation } from "@/components/clear-cart-on-confirmation"
import { CustomerOrderStatus } from "@/components/customer-order-status"
import { formatLineItem, formatMoney, titleCase } from "@/lib/format"
import { markOrderPaidAndReduceStock, markOrderPaidAndReduceStockByPaymentIntent } from "@/lib/orders"
import { prisma } from "@/lib/prisma"
import { formatSchedule } from "@/lib/scheduling"
import { getStripe } from "@/lib/stripe"
import { storeName } from "@/lib/store"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Order Confirmation",
  description: `Review your ${storeName} order confirmation and fulfillment status.`
}

function customerOrderStatusLabel(status: string) {
  if (status === "CANCELLED") return "Order cancelled"
  if (status === "REFUNDED") return "Order refunded"
  if (status === "DELIVERED") return "Completed"
  if (status === "PREPARING") return "Preparing"
  if (status === "READY_FOR_PICKUP") return "Ready for pickup"
  if (status === "OUT_FOR_DELIVERY") return "Out for delivery"
  return "Order received"
}

function customerPaymentStatusLabel(status: string, fulfillmentMethod: string) {
  if (status === "PAID") return "Paid"
  if (status === "FAILED") return "Payment failed"
  if (status === "REFUNDED") return "Refunded"
  if (fulfillmentMethod === "PICKUP") return "Payment due at pickup"
  return "Payment pending"
}

export default async function OrderConfirmationPage({
  searchParams
}: {
  searchParams: Promise<{ order?: string; payment_intent?: string; session_id?: string; token?: string }>
}) {
  const { order: orderId, payment_intent: paymentIntentId, session_id: sessionId, token } = await searchParams
  let paymentVerified = false

  if (orderId && sessionId) {
    const session = await getStripe().checkout.sessions.retrieve(sessionId)
    if (session.payment_status === "paid" && session.metadata?.orderId === orderId) {
      paymentVerified = true
      try {
        await markOrderPaidAndReduceStock(orderId, session.id)
      } catch {
        // Webhooks retry payment finalization; keep the confirmation page available.
      }
    }
  }

  if (orderId && paymentIntentId) {
    const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId)
    const metadataOrderId = paymentIntent.metadata?.orderId
    if ((paymentIntent.status === "succeeded" || paymentIntent.status === "processing") && (!metadataOrderId || metadataOrderId === orderId)) {
      paymentVerified = true
      if (paymentIntent.status === "succeeded") {
        try {
          await markOrderPaidAndReduceStockByPaymentIntent(orderId, paymentIntent.id)
        } catch {
          // Webhooks retry payment finalization; keep the confirmation page available.
        }
      }
    }
  }

  const order = orderId && (paymentVerified || token)
    ? await prisma.order.findFirst({
        where: {
          id: orderId,
          ...(paymentVerified ? {} : { accessToken: token })
        },
        include: { items: true }
      })
    : null

  return (
    <main className="shell">
      <ClearCartOnConfirmation />
      <section className="panel" style={{ marginTop: 30 }}>
        <p className="badge">Order received</p>
        <h1 className="order-confirmation-heading">Thank you — we received your order.</h1>
        {order ? (
          <>
            {(() => {
              const schedule = formatSchedule(order.scheduledDate, order.scheduledWindow)
              const trackerToken = token ?? order.accessToken
              const fulfillmentLabel = titleCase(order.fulfillmentMethod.toLowerCase())
              const pickupOrDeliveryLabel = order.fulfillmentMethod === "DELIVERY" ? "Delivery" : "Pickup"

              return (
                <>
            <p className="muted">
              Your order has been sent to our grocery team. We&apos;ll prepare it for your scheduled pickup or delivery.
            </p>
            <div style={{ margin: "20px 0" }}>
              <h2 className="order-confirmation-section-title">Next steps</h2>
              <div className="summary-line">
                <span>Fulfillment</span>
                <strong>{fulfillmentLabel}</strong>
              </div>
              {schedule ? (
                <div className="summary-line">
                  <span>{pickupOrDeliveryLabel} date/time</span>
                  <strong>{schedule}</strong>
                </div>
              ) : order.deliveryWindow ? (
                <div className="summary-line">
                  <span>{order.fulfillmentMethod === "DELIVERY" ? "Delivery window" : "Pickup window"}</span>
                  <strong>{order.deliveryWindow}</strong>
                </div>
              ) : null}
              {order.customerPhone ? (
                <div className="summary-line">
                  <span>Phone</span>
                  <strong>{order.customerPhone}</strong>
                </div>
              ) : null}
              <div className="summary-line">
                <span>{order.fulfillmentMethod === "DELIVERY" ? "Delivery address" : "Pickup method"}</span>
                <strong>{order.fulfillmentMethod === "DELIVERY" ? order.deliveryAddress : "In-store pickup"}</strong>
              </div>
              {order.deliveryInstructions ? (
                <div className="summary-line">
                  <span>Delivery instructions</span>
                  <strong>{order.deliveryInstructions}</strong>
                </div>
              ) : null}
              {trackerToken ? (
                <CustomerOrderStatus
                  initial={{
                    fulfillmentMethod: order.fulfillmentMethod,
                    isTerminal: order.status === "DELIVERED" || order.status === "CANCELLED" || order.status === "REFUNDED",
                    paymentLabel: customerPaymentStatusLabel(order.paymentStatus, order.fulfillmentMethod),
                    paymentStatus: order.paymentStatus,
                    schedule,
                    status: order.status,
                    statusLabel: customerOrderStatusLabel(order.status),
                    updatedAt: order.updatedAt.toISOString()
                  }}
                  orderId={order.id}
                  token={trackerToken}
                />
              ) : (
                <>
                  <div className="summary-line">
                    <span>Order status</span>
                    <strong>{customerOrderStatusLabel(order.status)}</strong>
                  </div>
                  <div className="summary-line">
                    <span>Payment status</span>
                    <strong>{customerPaymentStatusLabel(order.paymentStatus, order.fulfillmentMethod)}</strong>
                  </div>
                </>
              )}
              <h2 className="order-confirmation-section-title">Items ordered</h2>
              {order.items.map((item) => (
                <div className="summary-line" key={item.id}>
                  <span>{formatLineItem(item.productName, item.quantity, item.priceCents, item.saleUnit)}</span>
                  <strong>{formatMoney(Math.round(item.priceCents * item.quantity))}</strong>
                </div>
              ))}
              <div className="summary-line">
                <span>Subtotal</span>
                <strong>{formatMoney(order.subtotalCents)}</strong>
              </div>
              {order.discountCents > 0 ? (
                <div className="summary-line savings">
                  <span>Discount{order.discountCode ? ` (${order.discountCode})` : ""}</span>
                  <strong>-{formatMoney(order.discountCents)}</strong>
                </div>
              ) : null}
              <div className="summary-line">
                <span>Tax</span>
                <strong>{formatMoney(order.taxCents)}</strong>
              </div>
              <div className="summary-line">
                <span>{order.fulfillmentMethod === "DELIVERY" ? "Delivery fee" : "Pickup fee"}</span>
                <strong>{formatMoney(order.deliveryFeeCents)}</strong>
              </div>
              <div className="summary-line total">
                <span>Total</span>
                <strong>{formatMoney(order.totalCents)}</strong>
              </div>
            </div>
                </>
              )
            })()}
          </>
        ) : (
          <p className="muted">Your order confirmation is ready.</p>
        )}
        <Link className="button" href="/products">Continue shopping</Link>
        {order?.accessToken ? <Link className="button secondary" href={`/account/orders?order=${order.id}&token=${order.accessToken}`} style={{ marginLeft: 10 }}>View order history</Link> : null}
      </section>
    </main>
  )
}
