import Link from "next/link"
import { notFound } from "next/navigation"

import { AdminNav } from "@/components/admin-nav"
import { OrderWorkflowActions } from "@/components/admin-order-workflow"
import { AdminActionForm, SubmitButton } from "@/components/admin-ui"
import { CopyButton } from "@/components/copy-button"
import { updateOrderStatus } from "@/lib/actions"
import { formatLineItem, formatMoney } from "@/lib/format"
import { adminOrderStatuses, canTransitionOrderStatus, orderStatusLabel, paymentStatusLabel } from "@/lib/orders"
import { prisma } from "@/lib/prisma"
import { formatSchedule } from "@/lib/scheduling"
import type { OrderStatus, PaymentStatus } from "@prisma/client"

export const dynamic = "force-dynamic"

function orderDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value)
}

function inventoryStatusText(order: {
  paymentStatus: PaymentStatus
  status: OrderStatus
  stockReduced: boolean
}) {
  if (order.paymentStatus === "REFUNDED" || order.status === "REFUNDED" || order.status === "CANCELLED") {
    return "Inventory released"
  }

  if (order.paymentStatus === "PAID" && order.stockReduced) {
    return "Inventory reserved"
  }

  if (order.paymentStatus === "PENDING" || order.paymentStatus === "FAILED") {
    return "Inventory not reserved yet"
  }

  return "Inventory pending review"
}

function shortOrderId(id: string) {
  return id.length > 10 ? `${id.slice(0, 10)}...` : id
}

export default async function AdminOrderDetailsPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!id) {
    notFound()
  }

  const [order, pendingOrders, lowStockProducts] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: { items: true }
    }),
    prisma.order.count({ where: { status: { in: ["RECEIVED", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"] } } }),
    prisma.product.findMany({
      where: { isActive: true, stock: { gt: 0 } },
      select: { id: true, lowStockThreshold: true, stock: true }
    })
  ])

  if (!order) {
    notFound()
  }

  const lowStockCount = lowStockProducts.filter((product) => product.stock <= product.lowStockThreshold).length
  const schedule = formatSchedule(order.scheduledDate, order.scheduledWindow)
  const displayOrderId = shortOrderId(order.id)
  const paymentAllowsFulfillment = order.paymentStatus === "PAID"
  const hasAnyStatusUpdate = adminOrderStatuses.some((status) => status !== order.status && canTransitionOrderStatus(order.status, status, order.paymentStatus))

  return (
    <main className="shell">
      <div className="page-title">
        <p className="admin-kicker">Store admin</p>
        <h1>Order details</h1>
        <p>Review customer, items, totals, payment, and fulfillment workflow.</p>
        <AdminNav active="orders" lowStockCount={lowStockCount} pendingOrderCount={pendingOrders} />
        <Link className="button secondary admin-header-action" href="/admin/orders">Back to orders</Link>
      </div>

      <article className="admin-card order-card">
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

          <div className="order-grid">
            <div>
              <strong>Customer name</strong>
              <p>{order.customerName}</p>
              <strong>Email</strong>
              <p>{order.customerEmail}</p>
              {order.customerPhone ? (
                <>
                  <strong>Phone</strong>
                  <p>{order.customerPhone}</p>
                </>
              ) : null}
            </div>
            <div>
              <strong>Delivery or pickup</strong>
              <p>{order.fulfillmentMethod === "DELIVERY" ? "Delivery" : "Pickup"}</p>
              <p>{order.fulfillmentMethod === "DELIVERY" ? "Delivery order" : "Pickup order"}</p>
              {schedule ? <p>Scheduled: {schedule}</p> : order.deliveryWindow ? <p>Window: {order.deliveryWindow}</p> : null}
            </div>
            <div>
              <strong>{order.fulfillmentMethod === "DELIVERY" ? "Delivery address" : "Pickup"}</strong>
              <p>{order.fulfillmentMethod === "DELIVERY" ? order.deliveryAddress : "In-store pickup"}</p>
              {order.deliveryInstructions ? <p>Instructions: {order.deliveryInstructions}</p> : null}
            </div>
            <div>
              <strong>Timestamps</strong>
              <strong>Date</strong>
              <p>{orderDate(order.createdAt)}</p>
              <strong>Updated</strong>
              <p>{orderDate(order.updatedAt)}</p>
              {order.paidAt ? (
                <>
                  <strong>Paid</strong>
                  <p>{orderDate(order.paidAt)}</p>
                </>
              ) : null}
              {order.deliveredAt ? (
                <>
                  <strong>Delivered</strong>
                  <p>{orderDate(order.deliveredAt)}</p>
                </>
              ) : null}
              {order.driverName ? (
                <>
                  <strong>Driver</strong>
                  <p>{order.driverName}</p>
                </>
              ) : null}
              {order.estimatedDeliveryTime ? (
                <>
                  <strong>Estimated delivery</strong>
                  <p>{orderDate(order.estimatedDeliveryTime)}</p>
                </>
              ) : null}
            </div>
            <div>
              <strong>Items ordered</strong>
              {order.items.map((item) => (
                <p key={item.id}>{formatLineItem(item.productName, item.quantity, item.priceCents, item.saleUnit)}</p>
              ))}
            </div>
            <div>
              <strong>Totals</strong>
              <p>Subtotal: {formatMoney(order.subtotalCents)}</p>
              {order.discountCents > 0 ? <p>Discount{order.discountCode ? ` (${order.discountCode})` : ""}: -{formatMoney(order.discountCents)}</p> : null}
              <p>Tax: {formatMoney(order.taxCents)}</p>
              <p>Delivery: {formatMoney(order.deliveryFeeCents)}</p>
              <p><strong>Total: {formatMoney(order.totalCents)}</strong></p>
            </div>
            <div>
              <strong>System Status</strong>
              <p>Payment: {paymentStatusLabel(order.paymentStatus)}</p>
              <p>{inventoryStatusText(order)}</p>
            </div>
          </div>

          {order.status === "CANCELLED" ? null : !paymentAllowsFulfillment ? (
            <div className="order-status-form">
              <label className="form-field">
                <span>Order status</span>
                <select className="select" defaultValue={order.status} disabled>
                  <option value={order.status}>{orderStatusLabel(order.status, order.fulfillmentMethod)}</option>
                </select>
              </label>
              <button className="button secondary" disabled type="button">Update status</button>
            </div>
          ) : (
            <AdminActionForm action={updateOrderStatus.bind(null, order.id)} className="order-status-form">
              <label className="form-field">
                <span>Order status</span>
                <select className="select" defaultValue={order.status} disabled={!hasAnyStatusUpdate} name="status">
                  {adminOrderStatuses.map((status) => {
                    const disabled = status !== order.status && !canTransitionOrderStatus(order.status, status, order.paymentStatus)
                    return (
                      <option disabled={disabled} key={status} value={status}>{orderStatusLabel(status, order.fulfillmentMethod)}</option>
                    )
                  })}
                </select>
              </label>
              <SubmitButton disabled={!hasAnyStatusUpdate} pendingLabel="Updating..." variant="secondary">Update status</SubmitButton>
            </AdminActionForm>
          )}

          <OrderWorkflowActions
            address={order.fulfillmentMethod === "DELIVERY" ? order.deliveryAddress : null}
            className="order-page-workflow"
            fulfillmentMethod={order.fulfillmentMethod}
            orderId={order.id}
            paymentStatus={order.paymentStatus}
            phone={order.customerPhone}
            showTimeline={order.status !== "CANCELLED"}
            status={order.status}
          />
        </div>
      </article>
    </main>
  )
}
