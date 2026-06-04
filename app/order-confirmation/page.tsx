import Link from "next/link"
import type { Metadata } from "next"

import { formatLineItem, formatMoney, titleCase } from "@/lib/format"
import { markOrderPaidAndReduceStock, orderStatusLabel, paymentStatusLabel } from "@/lib/orders"
import { prisma } from "@/lib/prisma"
import { formatSchedule } from "@/lib/scheduling"
import { getStripe } from "@/lib/stripe"
import { storeName } from "@/lib/store"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Order Confirmation",
  description: `Review your ${storeName} order confirmation and fulfillment status.`
}

export default async function OrderConfirmationPage({
  searchParams
}: {
  searchParams: Promise<{ order?: string; session_id?: string; token?: string }>
}) {
  const { order: orderId, session_id: sessionId, token } = await searchParams
  let sessionVerified = false

  if (orderId && sessionId) {
    const session = await getStripe().checkout.sessions.retrieve(sessionId)
    if (session.payment_status === "paid" && session.metadata?.orderId === orderId) {
      sessionVerified = true
      try {
        await markOrderPaidAndReduceStock(orderId, session.id)
      } catch {
        // Webhooks retry payment finalization; keep the confirmation page available.
      }
    }
  }

  const order = orderId && (sessionVerified || token)
    ? await prisma.order.findFirst({
        where: {
          id: orderId,
          ...(sessionVerified ? {} : { accessToken: token })
        },
        include: { items: true }
      })
    : null

  return (
    <main className="shell">
      <section className="panel" style={{ marginTop: 30 }}>
        <p className="badge">Order received</p>
        <h1 style={{ fontSize: "2.4rem", marginBottom: 8 }}>Thanks for shopping {storeName}.</h1>
        {order ? (
          <>
            {(() => {
              const schedule = formatSchedule(order.scheduledDate, order.scheduledWindow)

              return (
                <>
            <p className="muted">
              Order {order.id} is confirmed. We sent the grocery team your items and fulfillment details.
            </p>
            <div style={{ margin: "20px 0" }}>
              <div className="summary-line">
                <span>Fulfillment</span>
                <strong>{titleCase(order.fulfillmentMethod.toLowerCase())}</strong>
              </div>
              {schedule ? (
                <div className="summary-line">
                  <span>{order.fulfillmentMethod === "DELIVERY" ? "Scheduled delivery" : "Scheduled pickup"}</span>
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
                <span>{order.fulfillmentMethod === "DELIVERY" ? "Delivery address" : "Pickup"}</span>
                <strong>{order.fulfillmentMethod === "DELIVERY" ? order.deliveryAddress : "In-store pickup"}</strong>
              </div>
              {order.deliveryInstructions ? (
                <div className="summary-line">
                  <span>Delivery instructions</span>
                  <strong>{order.deliveryInstructions}</strong>
                </div>
              ) : null}
              <div className="summary-line">
                <span>Order status</span>
                <strong>{orderStatusLabel(order.status, order.fulfillmentMethod)}</strong>
              </div>
              <div className="summary-line">
                <span>Payment status</span>
                <strong>{paymentStatusLabel(order.paymentStatus)}</strong>
              </div>
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
