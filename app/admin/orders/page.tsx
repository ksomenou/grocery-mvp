import { AdminNav } from "@/components/admin-nav"
import { OrderWorkflowActions, FulfillmentTimeline } from "@/components/admin-order-workflow"
import { AdminActionForm, EmptyState, SubmitButton } from "@/components/admin-ui"
import { CopyButton } from "@/components/copy-button"
import { updateOrderStatus } from "@/lib/actions"
import { formatLineItem, formatMoney } from "@/lib/format"
import { adminOrderStatuses, canTransitionOrderStatus, isFulfillmentStatus, orderStatusLabel, paymentStatusLabel } from "@/lib/orders"
import { prisma } from "@/lib/prisma"
import { formatSchedule } from "@/lib/scheduling"
import type { FulfillmentMethod, OrderStatus, PaymentStatus } from "@prisma/client"

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
        </form>
      </div>

      <section className="admin-list single">
        {orders.length === 0 ? (
          <EmptyState title="No orders yet" message="New paid grocery delivery orders will appear here." />
        ) : (
          orders.map((order) => {
            const schedule = formatSchedule(order.scheduledDate, order.scheduledWindow)
            const paymentAllowsFulfillment = order.paymentStatus === "PAID"
            const canCancelUnpaid =
              !paymentAllowsFulfillment &&
              order.status !== "CANCELLED" &&
              order.status !== "REFUNDED" &&
              canTransitionOrderStatus(order.status, "CANCELLED", order.paymentStatus)
            const hasAnyStatusUpdate = adminOrderStatuses.some((status) => status !== order.status && canTransitionOrderStatus(order.status, status, order.paymentStatus))

            return (
              <article className="admin-card order-card" key={order.id}>
                <div className="admin-card-main">
                  <div className="admin-card-head">
                    <div>
                      <p className="muted">{orderDate(order.createdAt)}</p>
                      <h2>{order.customerName}</h2>
                      <p className="muted">{order.customerEmail}</p>
                      <p className="order-id-line">
                        <span>Order ID: {order.id}</span>
                        <CopyButton label="Copy ID" value={order.id} />
                      </p>
                    </div>
                    <div className="order-badge-stack">
                      <span className={`status-badge status-${order.status.toLowerCase()}`}>Fulfillment: {orderStatusLabel(order.status, order.fulfillmentMethod)}</span>
                      <span className={`status-badge payment-${order.paymentStatus.toLowerCase()}`}>Payment: {paymentStatusLabel(order.paymentStatus)}</span>
                    </div>
                  </div>

                  <FulfillmentTimeline fulfillmentMethod={order.fulfillmentMethod} status={order.status} />

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
                    <strong>Fulfillment status</strong>
                    <p>{orderStatusLabel(order.status, order.fulfillmentMethod)}</p>
                    <strong>Payment status</strong>
                    <p>{paymentStatusLabel(order.paymentStatus)}</p>
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
                    {"driverName" in order && order.driverName ? (
                      <>
                        <strong>Driver</strong>
                        <p>{order.driverName}</p>
                      </>
                    ) : null}
                    {"estimatedDeliveryTime" in order && order.estimatedDeliveryTime ? (
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
                    <p>Delivery: {formatMoney(order.deliveryFeeCents)}</p>
                    <p><strong>Total: {formatMoney(order.totalCents)}</strong></p>
                    <p>Payment: {paymentStatusLabel(order.paymentStatus)}</p>
                    <p>{inventoryStatusText(order)}</p>
                  </div>
                </div>

                  {!paymentAllowsFulfillment ? (
                    <div className="order-status-form">
                      <label className="form-field">
                        <span>Order status</span>
                        <select className="select" defaultValue={order.status} disabled>
                          <option value={order.status}>{orderStatusLabel(order.status, order.fulfillmentMethod)}</option>
                        </select>
                      </label>
                      <button className="button secondary" disabled type="button">Update status</button>
                      <p className="order-helper-text">Payment must be paid before fulfillment can begin.</p>
                      {canCancelUnpaid ? (
                        <AdminActionForm action={updateOrderStatus.bind(null, order.id)} className="order-cancel-form">
                          <input name="status" type="hidden" value="CANCELLED" />
                          <SubmitButton pendingLabel="Cancelling..." variant="secondary">Cancel order</SubmitButton>
                        </AdminActionForm>
                      ) : null}
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
                    status={order.status}
                  />
                </div>
              </article>
            )
          })
        )}
      </section>
    </main>
  )
}
