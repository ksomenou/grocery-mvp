import Link from "next/link"
import { notFound } from "next/navigation"

import { AdminNav } from "@/components/admin-nav"
import { OrderWorkflowActions } from "@/components/admin-order-workflow"
import { AdminActionForm, SubmitButton } from "@/components/admin-ui"
import { CopyButton } from "@/components/copy-button"
import { PermissionDenied } from "@/components/permission-denied"
import { PrintButton } from "@/components/print-button"
import { updateOrderStatus } from "@/lib/actions"
import { requirePermission } from "@/lib/admin-auth"
import { formatLineItem, formatMoney, formatQuantity, formatUnitPrice } from "@/lib/format"
import { adminOrderStatuses, canTransitionOrderStatus, orderStatusLabel, paymentStatusLabel } from "@/lib/orders"
import { hasPermission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { refundOrder } from "@/lib/refund-actions"
import { formatSchedule } from "@/lib/scheduling"
import type { OrderStatus, PaymentStatus } from "@prisma/client"

export const dynamic = "force-dynamic"

type RefundHistoryRow = {
  id: string
  refundAmountCents: number
  refundReason: string
  refundedAt: Date
  refundedBy: string
}

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
  let user: Awaited<ReturnType<typeof requirePermission>>
  try {
    user = await requirePermission("orders:view")
  } catch {
    return <PermissionDenied />
  }

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

  const refunds = await prisma.$queryRaw<RefundHistoryRow[]>`
    SELECT "id", "refundAmountCents", "refundReason", "refundedAt", "refundedBy"
    FROM "OrderRefund"
    WHERE "orderId" = ${order.id}
    ORDER BY "refundedAt" DESC
  `

  const lowStockCount = lowStockProducts.filter((product) => product.stock <= product.lowStockThreshold).length
  const schedule = formatSchedule(order.scheduledDate, order.scheduledWindow)
  const displayOrderId = shortOrderId(order.id)
  const paymentAllowsFulfillment = order.paymentStatus === "PAID"
  const hasAnyStatusUpdate = adminOrderStatuses.some((status) => status !== order.status && canTransitionOrderStatus(order.status, status, order.paymentStatus))
  const canCreateRefunds = hasPermission(user.role, "refunds:create")
  const refundedCents = refunds.reduce((sum, refund) => sum + refund.refundAmountCents, 0)
  const refundableCents = Math.max(0, order.totalCents - refundedCents)
  const printTimestamp = orderDate(new Date())
  const printPaymentBadge = order.paymentStatus === "REFUNDED" ? "REFUNDED" : order.status === "PARTIALLY_REFUNDED" ? "PARTIALLY REFUNDED" : paymentStatusLabel(order.paymentStatus).toUpperCase()
  const printFulfillmentBadge = orderStatusLabel(order.status, order.fulfillmentMethod).toUpperCase()

  return (
    <main className="shell">
      <div className="page-title">
        <p className="admin-kicker">Store admin</p>
        <h1>Order details</h1>
        <p>Review customer, items, totals, payment, and fulfillment workflow.</p>
        <AdminNav active="orders" lowStockCount={lowStockCount} pendingOrderCount={pendingOrders} />
        <div className="admin-header-actions no-print">
          <PrintButton />
          <Link className="button secondary" href="/admin/orders" prefetch={false}>Back to orders</Link>
        </div>
      </div>

      <section aria-label="Printable order summary" className="print-order-summary">
        <header className="print-order-header">
          <div>
            <p>F &amp; A International Grocery</p>
            <h1>Order summary</h1>
            <address className="print-store-contact">
              413 Main St #103, Williston, ND<br />
              701-651-7071<br />
              support@fainternationalgrocery.com
            </address>
          </div>
          <div>
            <strong>Order ID</strong>
            <span>{order.id}</span>
          </div>
        </header>

        <div className="print-order-meta">
          <div>
            <strong>Order date</strong>
            <span>{orderDate(order.createdAt)}</span>
          </div>
          <div>
            <strong>Payment status</strong>
            <span className={`print-status-badge print-payment-${order.paymentStatus.toLowerCase()}`}>{printPaymentBadge}</span>
          </div>
          <div>
            <strong>Fulfillment status</strong>
            <span className={`print-status-badge print-fulfillment-${order.status.toLowerCase()}`}>{printFulfillmentBadge}</span>
          </div>
          <div>
            <strong>Type</strong>
            <span>{order.fulfillmentMethod === "DELIVERY" ? "Delivery" : "Pickup"}</span>
          </div>
        </div>

        <div className="print-order-grid">
          <section>
            <h2>Customer</h2>
            <p>{order.customerName}</p>
            <p>{order.customerEmail}</p>
            {order.customerPhone ? <p>{order.customerPhone}</p> : null}
          </section>
          <section>
            <h2>{order.fulfillmentMethod === "DELIVERY" ? "Delivery" : "Pickup"}</h2>
            <p>{order.fulfillmentMethod === "DELIVERY" ? order.deliveryAddress : "In-store pickup"}</p>
            {schedule ? <p>{order.fulfillmentMethod === "DELIVERY" ? "Scheduled" : "Pickup window"}: {schedule}</p> : order.deliveryWindow ? <p>Window: {order.deliveryWindow}</p> : null}
            {order.deliveryInstructions ? <p>Instructions: {order.deliveryInstructions}</p> : null}
          </section>
        </div>

        <section className="print-order-section">
          <h2>Items ordered</h2>
          <table className="print-order-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Item price</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.productName}</td>
                  <td>{formatQuantity(item.quantity, item.saleUnit)}</td>
                  <td>{formatUnitPrice(item.priceCents, item.saleUnit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="print-order-totals">
          <div><span>Subtotal</span><strong>{formatMoney(order.subtotalCents)}</strong></div>
          {order.discountCents > 0 ? <div><span>Discount{order.discountCode ? ` (${order.discountCode})` : ""}</span><strong>-{formatMoney(order.discountCents)}</strong></div> : null}
          <div><span>Tax</span><strong>{formatMoney(order.taxCents)}</strong></div>
          <div><span>Delivery fee</span><strong>{formatMoney(order.deliveryFeeCents)}</strong></div>
          <div className="print-order-total"><span>Total</span><strong>{formatMoney(order.totalCents)}</strong></div>
        </section>

        {order.deliveryInstructions ? (
          <section className="print-order-section print-order-notes">
            <h2>Order notes / special instructions</h2>
            <p>{order.deliveryInstructions}</p>
          </section>
        ) : null}

        {refunds.length > 0 ? (
          <section className="print-order-section print-refund-summary">
            <h2>Refund summary</h2>
            <table className="print-order-table">
              <thead>
                <tr>
                  <th>Refund amount</th>
                  <th>Refund date</th>
                  <th>Refund reason</th>
                  <th>Refunded by</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((refund) => (
                  <tr key={refund.id}>
                    <td>{formatMoney(refund.refundAmountCents)}</td>
                    <td>{orderDate(refund.refundedAt)}</td>
                    <td>{refund.refundReason}</td>
                    <td>{refund.refundedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <section className="print-staff-processing">
          <h2>Staff processing</h2>
          <div className="print-staff-grid">
            <p>Prepared by: ____________________</p>
            <p>Checked by: ____________________</p>
            <p>Pickup/Delivery confirmed by: ____________________</p>
            <p>Date: ____________________</p>
          </div>
        </section>

        <footer className="print-order-footer">
          Printed: {printTimestamp}
        </footer>
      </section>

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

          {canCreateRefunds ? (
            <section className="order-refund-section">
              <div className="admin-card-head">
                <div>
                  <p className="muted">Stripe refunds</p>
                  <h2>Refund</h2>
                </div>
                <span className="status-badge status-confirmed">Refundable: {formatMoney(refundableCents)}</span>
              </div>

              {order.paymentStatus === "PAID" && refundableCents > 0 ? (
                <div className="refund-action-grid">
                  <AdminActionForm action={refundOrder.bind(null, order.id)} className="form-grid" confirmMessage={`Process a full refund of ${formatMoney(refundableCents)}?`}>
                    <input name="type" type="hidden" value="FULL" />
                    <label className="form-field">
                      <span>Full refund reason</span>
                      <input className="field" name="reason" placeholder="Customer refund request" required />
                    </label>
                    <SubmitButton pendingLabel="Refunding..." variant="secondary">Full refund</SubmitButton>
                  </AdminActionForm>

                  <AdminActionForm action={refundOrder.bind(null, order.id)} className="form-grid" confirmMessage="Process this partial refund?">
                    <input name="type" type="hidden" value="PARTIAL" />
                    <label className="form-field">
                      <span>Partial amount</span>
                      <input className="field" max={(refundableCents / 100).toFixed(2)} min="0.01" name="amount" placeholder="0.00" required step="0.01" type="number" />
                    </label>
                    <label className="form-field">
                      <span>Partial refund reason</span>
                      <input className="field" name="reason" placeholder="Missing or damaged item" required />
                    </label>
                    <SubmitButton pendingLabel="Refunding..." variant="secondary">Partial refund</SubmitButton>
                  </AdminActionForm>
                </div>
              ) : (
                <p className="muted">No refundable paid balance remains for this order.</p>
              )}

              <div className="refund-history">
                <h3>Refund history</h3>
                {refunds.length === 0 ? (
                  <p className="muted">No refunds have been issued for this order.</p>
                ) : (
                  refunds.map((refund) => (
                    <div className="refund-history-row" key={refund.id}>
                      <div>
                        <strong>{formatMoney(refund.refundAmountCents)}</strong>
                        <p>{refund.refundReason}</p>
                      </div>
                      <div>
                        <span>{orderDate(refund.refundedAt)}</span>
                        <small>{refund.refundedBy}</small>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}
        </div>
      </article>
    </main>
  )
}
