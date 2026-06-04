import Link from "next/link"

import { formatLineItem, formatMoney, titleCase } from "@/lib/format"
import { orderStatusLabel } from "@/lib/orders"
import { prisma } from "@/lib/prisma"
import { formatSchedule } from "@/lib/scheduling"

export const dynamic = "force-dynamic"

export default async function AccountOrdersPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string; order?: string; token?: string }>
}) {
  const { email, order: orderId, token } = await searchParams
  const normalizedEmail = email?.trim().toLowerCase()
  const orders = orderId && token
    ? await prisma.order.findMany({
        where: { id: orderId, accessToken: token },
        include: { items: true },
        orderBy: { createdAt: "desc" }
      })
    : []

  return (
    <main className="shell">
      <div className="page-title">
        <h1>Order history</h1>
        <p>Use the secure link from your order confirmation to view grocery tracking status.</p>
        <form className="search-form" action="/account/orders">
          <input className="field" defaultValue={normalizedEmail ?? ""} name="email" placeholder="Email address" type="email" />
          <button className="button" type="submit">Find orders</button>
        </form>
      </div>

      <section className="admin-list single">
        {!normalizedEmail && !token ? (
          <div className="empty-state">
            <h3>Track your groceries</h3>
            <p>Use the secure order history link from your confirmation page to see order status updates.</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <h3>No orders found</h3>
            <p>We could not verify that order link. Check your confirmation page and try again.</p>
            <Link className="button secondary" href="/products">Start shopping</Link>
          </div>
        ) : (
          orders.map((order) => (
            (() => {
              const schedule = formatSchedule(order.scheduledDate, order.scheduledWindow)

              return (
            <article className="admin-card order-card" key={order.id}>
              <div className="admin-card-main">
                <div className="admin-card-head">
                  <div>
                    <p className="muted">{order.createdAt.toLocaleDateString()}</p>
                    <h2>{orderStatusLabel(order.status, order.fulfillmentMethod)}</h2>
                    <p className="muted">{order.fulfillmentMethod === "DELIVERY" ? order.deliveryAddress : "Pickup at store"}</p>
                    {schedule ? (
                      <p className="muted">{titleCase(order.fulfillmentMethod.toLowerCase())} schedule: {schedule}</p>
                    ) : order.deliveryWindow ? (
                      <p className="muted">{titleCase(order.fulfillmentMethod.toLowerCase())} window: {order.deliveryWindow}</p>
                    ) : null}
                  </div>
                  <strong>{formatMoney(order.totalCents)}</strong>
                </div>
                <div>
                  {order.items.map((item) => (
                    <p className="muted" key={item.id}>{formatLineItem(item.productName, item.quantity, item.priceCents, item.saleUnit)}</p>
                  ))}
                  {order.discountCents > 0 ? <p className="muted">Discount{order.discountCode ? ` (${order.discountCode})` : ""}: -{formatMoney(order.discountCents)}</p> : null}
                </div>
              </div>
            </article>
              )
            })()
          ))
        )}
      </section>
    </main>
  )
}
