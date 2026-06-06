import Link from "next/link"

import { AdminNav } from "@/components/admin-nav"
import { MobileOrderFilters } from "@/components/mobile-order-filters"
import { EmptyState } from "@/components/admin-ui"
import { CopyButton } from "@/components/copy-button"
import { formatMoney } from "@/lib/format"
import { adminOrderStatuses, isFulfillmentStatus, orderStatusLabel, paymentStatusLabel } from "@/lib/orders"
import { prisma } from "@/lib/prisma"
import type { FulfillmentMethod, OrderStatus, PaymentStatus } from "@prisma/client"

export const dynamic = "force-dynamic"

function orderDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value)
}

function shortOrderId(id: string) {
  return id.length > 10 ? `${id.slice(0, 10)}...` : id
}

export default async function AdminOrdersPage({
  searchParams
}: {
  searchParams: Promise<{ date?: string; method?: string; payment?: string; q?: string; status?: string }>
}) {
  const { date, method, payment, q, status } = await searchParams
  const paymentStatuses = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const
  const fulfillmentMethods = ["DELIVERY", "PICKUP"] as const
  const selectedStatus: OrderStatus | undefined = isFulfillmentStatus(status)
    ? (status as OrderStatus)
    : undefined
  const selectedPayment: PaymentStatus | undefined =
    typeof payment === "string" && paymentStatuses.includes(payment as PaymentStatus)
      ? (payment as PaymentStatus)
      : undefined
  const selectedMethod: FulfillmentMethod | undefined =
    typeof method === "string" && fulfillmentMethods.includes(method as FulfillmentMethod)
      ? (method as FulfillmentMethod)
      : undefined
  const query = q?.trim()
  const selectedDate = typeof date === "string" && date ? new Date(`${date}T00:00:00`) : null
  const activeAdvancedFilters = [selectedStatus, selectedPayment, selectedMethod, date].filter(Boolean).length
  const nextDate = selectedDate ? new Date(selectedDate) : null
  if (nextDate) {
    nextDate.setDate(nextDate.getDate() + 1)
  }
  
  const orderWhere = {
      ...(selectedStatus ? { status: selectedStatus } : {}),
      ...(selectedPayment ? { paymentStatus: selectedPayment } : {}),
      ...(selectedMethod ? { fulfillmentMethod: selectedMethod } : {}),
      ...(selectedDate && nextDate && !Number.isNaN(selectedDate.getTime()) ? { createdAt: { gte: selectedDate, lt: nextDate } } : {}),
      ...(query
        ? {
            OR: [
              { id: { contains: query, mode: "insensitive" as const } },
              { customerName: { contains: query, mode: "insensitive" as const } },
              { customerEmail: { contains: query, mode: "insensitive" as const } },
              { customerPhone: { contains: query, mode: "insensitive" as const } },
              { deliveryAddress: { contains: query, mode: "insensitive" as const } }
            ]
          }
        : {})
    }
  const [orders, pendingOrders, lowStockProducts] = await Promise.all([
    prisma.order.findMany({
    where: orderWhere,
    include: { items: true },
    orderBy: { createdAt: "desc" }
    }),
    prisma.order.count({ where: { status: { in: ["RECEIVED", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"] } } }),
    prisma.product.findMany({
      where: { isActive: true, stock: { gt: 0 } },
      select: { id: true, lowStockThreshold: true, stock: true }
    })
  ])
  const lowStockCount = lowStockProducts.filter((product) => product.stock <= product.lowStockThreshold).length

  return (
    <main className="shell">
      <div className="page-title">
        <p className="admin-kicker">Store admin</p>
        <h1>Orders</h1>
        <p>Manage delivery, pickup, payment, items, totals, and fulfillment status.</p>
        <AdminNav active="orders" lowStockCount={lowStockCount} pendingOrderCount={pendingOrders} />
        <form className="admin-filter-bar" action="/admin/orders">
          <label>
            <span>Search orders</span>
            <input className="field" defaultValue={query ?? ""} name="q" placeholder="Name, email, address, or ID" />
          </label>
          <MobileOrderFilters activeCount={activeAdvancedFilters}>
            <label>
              <span>Fulfillment status</span>
              <select className="select" defaultValue={selectedStatus} name="status">
                <option value="">All statuses</option>
                {adminOrderStatuses.map((value) => (
                  <option key={value} value={value}>{orderStatusLabel(value)}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Payment</span>
              <select className="select" defaultValue={selectedPayment} name="payment">
                <option value="">All payments</option>
                {paymentStatuses.map((value) => (
                  <option key={value} value={value}>{paymentStatusLabel(value)}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Delivery or pickup</span>
              <select className="select" defaultValue={selectedMethod} name="method">
                <option value="">All orders</option>
                {fulfillmentMethods.map((value) => (
                  <option key={value} value={value}>{value === "DELIVERY" ? "Delivery" : "Pickup"}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Order date</span>
              <input className="field" defaultValue={date ?? ""} name="date" type="date" />
            </label>
            <button className="button secondary" type="submit">Filter</button>
          </MobileOrderFilters>
        </form>
      </div>

      <section className="admin-list single">
        {orders.length === 0 ? (
          <EmptyState title="No orders yet" message="New paid grocery delivery orders will appear here." />
        ) : (
          orders.map((order) => {
            const displayOrderId = shortOrderId(order.id)

            return (
              <article className="admin-card order-card" key={order.id}>
                <div className="admin-card-main">
                  <div className="admin-card-head">
                    <div>
                      <p className="muted">{orderDate(order.createdAt)}</p>
                      <h2>{order.customerName}</h2>
                      <p className="muted">{order.customerEmail}</p>
                      <p className="order-id-line">
                        <span title={order.id}>Order ID: {displayOrderId}</span>
                        <CopyButton label="Copy ID" value={order.id} />
                      </p>
                    </div>
                    <div className="order-badge-stack">
                      <span className={`status-badge status-${order.status.toLowerCase()}`}>Fulfillment: {orderStatusLabel(order.status, order.fulfillmentMethod)}</span>
                      <span className={`status-badge payment-${order.paymentStatus.toLowerCase()}`}>Payment: {paymentStatusLabel(order.paymentStatus)}</span>
                    </div>
                  </div>
                  <div className="order-summary-row">
                    <span>{orderDate(order.createdAt)}</span>
                    <strong>{formatMoney(order.totalCents)}</strong>
                    <Link className="view-detail-link" href={`/admin/orders/${order.id}`}>View details</Link>
                  </div>
                </div>
              </article>
            )
          })
        )}
      </section>
    </main>
  )
}
