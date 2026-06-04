import Link from "next/link"
import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth"
import { formatMoney } from "@/lib/format"
import { orderStatusLabel } from "@/lib/orders"
import { prisma } from "@/lib/prisma"
import { storeName } from "@/lib/store"

export const dynamic = "force-dynamic"

export default async function AccountPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login?next=/account")
  }

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { userId: user.id },
        { customerEmail: user.email }
      ]
    },
    orderBy: { createdAt: "desc" },
    take: 5
  })

  return (
    <main className="shell">
      <div className="page-title">
        <h1>Account</h1>
        <p>Manage your {storeName} profile and recent grocery orders.</p>
      </div>
      <section className="panel form-grid">
        <div>
          <strong>Name</strong>
          <p className="muted">{user.name}</p>
        </div>
        <div>
          <strong>Email</strong>
          <p className="muted">{user.email}</p>
        </div>
      </section>
      <section className="section">
        <div className="section-head">
          <div>
            <h2>Recent orders</h2>
            <p>Latest orders connected to your account email.</p>
          </div>
          <Link className="button secondary" href="/products">Shop groceries</Link>
        </div>
        <div className="admin-list single">
          {orders.length === 0 ? (
            <div className="empty-state">
              <h3>No orders yet</h3>
              <p>Your recent {storeName} orders will appear here after checkout.</p>
            </div>
          ) : orders.map((order) => (
            <article className="admin-card order-card" key={order.id}>
              <div className="admin-card-main">
                <div className="admin-card-head">
                  <div>
                    <p className="muted">{order.createdAt.toLocaleDateString()}</p>
                    <h2>{orderStatusLabel(order.status, order.fulfillmentMethod)}</h2>
                    <p className="muted">{order.fulfillmentMethod === "DELIVERY" ? order.deliveryAddress : "Pickup at store"}</p>
                  </div>
                  <strong>{formatMoney(order.totalCents)}</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
