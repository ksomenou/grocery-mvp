import Link from "next/link"

import { AdminNav } from "@/components/admin-nav"
import { AdminNewOrderNotifier } from "@/components/admin-new-order-notifier"
import { formatMoney, formatQuantity, titleCase } from "@/lib/format"
import { getRecentOperationalEvents, operationalEventIcon, operationalEventTone } from "@/lib/operational-events"
import { orderStatusLabel, paymentStatusLabel } from "@/lib/orders"
import { prisma } from "@/lib/prisma"
import type { OrderStatus } from "@prisma/client"

export const dynamic = "force-dynamic"

type BestSellerRow = {
  productId: string
  name: string
  imageUrl: string
  quantitySold: number
  orderCount: number
  revenueCents: number
}

type RevenueRow = {
  total: number | null
}

const fulfillmentOverviewStatuses = [
  "RECEIVED",
  "CONFIRMED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED"
] satisfies OrderStatus[]

function metricTone(value: "healthy" | "low" | "urgent") {
  return `metric-card ${value}`
}

function stockPercent(stock: number, threshold: number) {
  return Math.max(4, Math.min(100, (stock / Math.max(threshold, 1)) * 100))
}

function paymentIcon(status: string) {
  return status === "PAID" ? "$" : status === "FAILED" ? "!" : "..."
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "FC"
}

function trend(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? "New activity" : "No change"
  }

  const percent = Math.round(((current - previous) / previous) * 100)
  return `${percent >= 0 ? "+" : ""}${percent}%`
}

function minutesAgo(date: Date) {
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000))
  if (minutes < 1) {
    return "received just now"
  }

  if (minutes < 60) {
    return `received ${minutes} min ago`
  }

  const hours = Math.round(minutes / 60)
  return `received ${hours} hr ago`
}

export default async function AdminPage() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const yearStart = new Date(today.getFullYear(), 0, 1)

  const [ordersToday, revenueTodayRows, paidOrdersToday, weekRevenueRows, ordersThisMonth, revenueThisMonthRows, ordersThisYear, revenueThisYearRows, pendingRows, activeProducts, lowStockProducts, soldOutProducts, fulfillmentStatusRows, recentOrders, paidOrders, allOrders, operationalEvents, topSellingProducts] = await Promise.all([
    prisma.order.count({
      where: {
        createdAt: { gte: today },
        paymentStatus: "PAID",
        status: { notIn: ["CANCELLED", "REFUNDED"] }
      }
    }),
    prisma.$queryRaw<RevenueRow[]>`
      SELECT COALESCE(SUM("totalCents"), 0)::int AS total
      FROM "Order"
      WHERE "createdAt" >= ${today}
      AND "paymentStatus"::text = 'PAID'
      AND "status"::text NOT IN ('CANCELLED', 'REFUNDED')
    `,
    prisma.order.count({
      where: {
        createdAt: { gte: today },
        paymentStatus: "PAID",
        status: { notIn: ["CANCELLED", "REFUNDED"] }
      }
    }),
    prisma.$queryRaw<RevenueRow[]>`
      SELECT COALESCE(SUM("totalCents"), 0)::int AS total
      FROM "Order"
      WHERE "createdAt" >= ${weekStart}
      AND "paymentStatus"::text = 'PAID'
      AND "status"::text NOT IN ('CANCELLED', 'REFUNDED')
    `,
    prisma.order.count({
      where: {
        createdAt: { gte: monthStart },
        paymentStatus: "PAID",
        status: { notIn: ["CANCELLED", "REFUNDED"] }
      }
    }),
    prisma.$queryRaw<RevenueRow[]>`
      SELECT COALESCE(SUM("totalCents"), 0)::int AS total
      FROM "Order"
      WHERE "createdAt" >= ${monthStart}
      AND "paymentStatus"::text = 'PAID'
      AND "status"::text NOT IN ('CANCELLED', 'REFUNDED')
    `,
    prisma.order.count({
      where: {
        createdAt: { gte: yearStart },
        paymentStatus: "PAID",
        status: { notIn: ["CANCELLED", "REFUNDED"] }
      }
    }),
    prisma.$queryRaw<RevenueRow[]>`
      SELECT COALESCE(SUM("totalCents"), 0)::int AS total
      FROM "Order"
      WHERE "createdAt" >= ${yearStart}
      AND "paymentStatus"::text = 'PAID'
      AND "status"::text NOT IN ('CANCELLED', 'REFUNDED')
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "Order"
      WHERE "status"::text IN ('RECEIVED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY')
      AND "paymentStatus"::text = 'PAID'
    `,
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.findMany({
      where: { isActive: true, stock: { gt: 0 } },
      select: {
        category: { select: { name: true } },
        id: true,
        lowStockThreshold: true,
        name: true,
        saleUnit: true,
        stock: true
      },
      orderBy: { stock: "asc" },
      take: 12
    }),
    prisma.product.findMany({
      where: { isActive: true, stock: { lte: 0 } },
      select: {
        category: { select: { name: true } },
        id: true,
        lowStockThreshold: true,
        name: true,
        saleUnit: true,
        stock: true
      },
      orderBy: { updatedAt: "desc" },
      take: 5
    }),
    prisma.order.groupBy({
      by: ["status"],
      where: {
        paymentStatus: "PAID",
        status: { in: fulfillmentOverviewStatuses }
      },
      _count: { _all: true }
    }),
    prisma.order.findMany({
      where: { paymentStatus: "PAID" },
      select: {
        createdAt: true,
        customerName: true,
        fulfillmentMethod: true,
        id: true,
        paymentStatus: true,
        status: true,
        totalCents: true,
        updatedAt: true
      },
      orderBy: { createdAt: "desc" },
      take: 7
    }),
    prisma.order.findMany({
      where: { paymentStatus: "PAID" },
      select: {
        createdAt: true,
        customerEmail: true,
        fulfillmentMethod: true,
        id: true,
        status: true,
        totalCents: true,
        updatedAt: true,
        items: {
          select: {
            quantity: true,
            product: { select: { category: { select: { name: true } } } }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 30
    }),
    prisma.order.findMany({
      where: { paymentStatus: "PAID" },
      select: {
        createdAt: true,
        customerName: true,
        fulfillmentMethod: true,
        id: true,
        status: true,
        updatedAt: true
      },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    getRecentOperationalEvents(20),
    prisma.$queryRaw<BestSellerRow[]>`
      SELECT
        oi."productId",
        oi."productName" AS "name",
        COALESCE(p."imageUrl", '/images/placeholder.svg') AS "imageUrl",
        SUM(oi."quantity")::float AS "quantitySold",
        COUNT(DISTINCT oi."orderId")::int AS "orderCount",
        SUM(ROUND(oi."quantity" * oi."priceCents"))::int AS "revenueCents"
      FROM "OrderItem" oi
      INNER JOIN "Order" o ON o."id" = oi."orderId"
      LEFT JOIN "Product" p ON p."id" = oi."productId"
      WHERE o."paymentStatus"::text = 'PAID'
      AND o."status"::text NOT IN ('CANCELLED', 'REFUNDED')
      GROUP BY oi."productId", oi."productName", p."imageUrl"
      ORDER BY SUM(oi."quantity") DESC, SUM(ROUND(oi."quantity" * oi."priceCents")) DESC
      LIMIT 4
    `
  ])

  const revenueCents = Number(revenueTodayRows[0]?.total ?? 0)
  const weekRevenueCents = Number(weekRevenueRows[0]?.total ?? 0)
  const monthRevenueCents = Number(revenueThisMonthRows[0]?.total ?? 0)
  const yearRevenueCents = Number(revenueThisYearRows[0]?.total ?? 0)
  const pendingOrders = Number(pendingRows[0]?.count ?? 0)
  const lowStockWatchlist = lowStockProducts.filter((product) => product.stock <= product.lowStockThreshold).slice(0, 8)
  const averageOrderValue = paidOrdersToday > 0 ? Math.round(revenueCents / paidOrdersToday) : 0
  const categories = new Map<string, number>()
  const sevenDaySales = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    date.setHours(0, 0, 0, 0)
    return { day: date.toLocaleDateString("en-US", { weekday: "short" }), orders: 0, total: 0 }
  })

  const validPaidOrders = paidOrders.filter((order) => order.status !== "CANCELLED" && order.status !== "REFUNDED")
  const avgBasketSize = validPaidOrders.length > 0
    ? validPaidOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0) / validPaidOrders.length
    : 0
  const deliveryOrders = validPaidOrders.filter((order) => order.fulfillmentMethod === "DELIVERY").length
  const pickupOrders = validPaidOrders.filter((order) => order.fulfillmentMethod === "PICKUP").length
  const fulfillmentTotal = Math.max(deliveryOrders + pickupOrders, 1)
  const deliveryQueue = allOrders.filter((order) => order.fulfillmentMethod === "DELIVERY" && ["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY"].includes(order.status)).slice(0, 4)
  const pickupQueue = allOrders.filter((order) => order.fulfillmentMethod === "PICKUP" && ["CONFIRMED", "PREPARING", "READY_FOR_PICKUP"].includes(order.status)).slice(0, 4)
  const readyNowQueue = allOrders.filter((order) => order.status === "READY_FOR_PICKUP" || order.status === "OUT_FOR_DELIVERY").slice(0, 4)

  for (const order of validPaidOrders) {
    const orderDay = order.createdAt.toLocaleDateString("en-US", { weekday: "short" })
    const day = sevenDaySales.find((item) => item.day === orderDay)
    if (day) {
      day.orders += 1
      day.total += order.totalCents
    }

    for (const item of order.items) {
      const categoryName = item.product.category.name
      categories.set(categoryName, (categories.get(categoryName) ?? 0) + item.quantity)
    }
  }

  const topSellingCategory = Array.from(categories.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "No sales data available"
  const hasSalesData = sevenDaySales.some((item) => item.total > 0 || item.orders > 0)
  const maxSales = Math.max(...sevenDaySales.map((item) => item.total), 1)
  const maxOrders = Math.max(...sevenDaySales.map((item) => item.orders), 1)
  const chartPoints = sevenDaySales.map((item, index) => ({
    x: 8 + index * 14,
    y: 82 - (item.total / maxSales) * 68
  }))
  const linePath = chartPoints
    .map((point, index) => {
      if (index === 0) {
        return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
      }

      const previous = chartPoints[index - 1]
      const midX = (previous.x + point.x) / 2
      return `C ${midX.toFixed(1)} ${previous.y.toFixed(1)}, ${midX.toFixed(1)} ${point.y.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    })
    .join(" ")
  const areaPath = `${linePath} L ${chartPoints.at(-1)?.x.toFixed(1) ?? "92.0"} 88 L ${chartPoints[0]?.x.toFixed(1) ?? "8.0"} 88 Z`
  const busiestDay = sevenDaySales.reduce((best, item) => (item.total > best.total ? item : best), sevenDaySales[0])
  const todaySales = sevenDaySales[6]?.total ?? 0
  const previousSales = sevenDaySales[5]?.total ?? 0
  const todayOrderCount = sevenDaySales[6]?.orders ?? 0
  const previousOrderCount = sevenDaySales[5]?.orders ?? 0
  const uniqueCustomers = new Set(validPaidOrders.map((order) => order.customerEmail)).size
  const repeatCustomers = Math.max(0, validPaidOrders.length - uniqueCustomers)
  const repeatRate = validPaidOrders.length > 0 ? Math.round((repeatCustomers / validPaidOrders.length) * 100) : 0
  const fulfillmentCounts = new Map<OrderStatus, number>(
    fulfillmentStatusRows.map((row) => [row.status, row._count._all])
  )
  const receivedCount = fulfillmentCounts.get("RECEIVED") ?? 0
  const confirmedCount = fulfillmentCounts.get("CONFIRMED") ?? 0
  const preparingCount = fulfillmentCounts.get("PREPARING") ?? 0
  const readyCount = fulfillmentCounts.get("READY_FOR_PICKUP") ?? 0
  const outForDeliveryCount = fulfillmentCounts.get("OUT_FOR_DELIVERY") ?? 0
  const deliveredCount = fulfillmentCounts.get("DELIVERED") ?? 0
  const cancelledCount = fulfillmentCounts.get("CANCELLED") ?? 0
  const fulfillmentOverviewTotal = [...fulfillmentCounts.values()].reduce((sum, count) => sum + count, 0)
  const deliveredOrders = allOrders.filter((order) => order.status === "DELIVERED" && order.updatedAt > order.createdAt)
  const avgFulfillmentMinutes = deliveredOrders.length > 0
    ? Math.round(deliveredOrders.reduce((sum, order) => sum + (order.updatedAt.getTime() - order.createdAt.getTime()) / 60000, 0) / deliveredOrders.length)
    : null
  const avgFulfillmentLabel = avgFulfillmentMinutes === null
    ? "No completed orders yet"
    : avgFulfillmentMinutes >= 60
      ? `${Math.round(avgFulfillmentMinutes / 60)} hr avg`
      : `${avgFulfillmentMinutes} min avg`
  return (
    <main className="shell admin-dashboard-page">
      <AdminNewOrderNotifier initialOrderId={recentOrders[0]?.id ?? null} />
      <div className="page-title admin-dashboard-title">
        <div>
          <p className="admin-kicker">Store admin</p>
          <h1>Operations dashboard</h1>
          <p>Monitor orders, sales, inventory risk, and daily grocery operations.</p>
        </div>
        <AdminNav active="dashboard" lowStockCount={lowStockWatchlist.length} pendingOrderCount={pendingOrders} />
      </div>

      <section className="admin-metrics dense">
        <article className={metricTone("healthy")}><span><b>O</b> Today orders</span><strong>{ordersToday}</strong><small>{trend(todayOrderCount, previousOrderCount)} vs yesterday</small></article>
        <article className={metricTone("healthy")}><span><b>$</b> Today revenue</span><strong>{formatMoney(revenueCents)}</strong><small>{trend(todaySales, previousSales)} vs yesterday</small></article>
        <article className={metricTone("healthy")}><span><b>W</b> Week revenue</span><strong>{formatMoney(weekRevenueCents)}</strong><small>Paid orders this week</small></article>
        <article className={metricTone("healthy")}><span><b>M</b> Month orders</span><strong>{ordersThisMonth}</strong><small>Current calendar month</small></article>
        <article className={metricTone("healthy")}><span><b>$</b> Month revenue</span><strong>{formatMoney(monthRevenueCents)}</strong><small>Paid orders this month</small></article>
        <article className={metricTone("healthy")}><span><b>Y</b> Year orders</span><strong>{ordersThisYear}</strong><small>Current calendar year</small></article>
        <article className={metricTone("healthy")}><span><b>$</b> Year revenue</span><strong>{formatMoney(yearRevenueCents)}</strong><small>Paid orders this year</small></article>
        <article className={metricTone(pendingOrders > 6 ? "urgent" : pendingOrders > 0 ? "low" : "healthy")}><span><b>Q</b> Pending orders</span><strong>{pendingOrders}</strong><small>Received, preparing, ready</small></article>
        <article className={metricTone(lowStockWatchlist.length > 0 ? "low" : "healthy")}><span><b>S</b> Low stock items</span><strong>{lowStockWatchlist.length}</strong><small>{soldOutProducts.length} sold out</small></article>
        <article className={metricTone("healthy")}><span><b>A</b> Avg. order value</span><strong>{formatMoney(averageOrderValue)}</strong><small>Today</small></article>
        <article className={metricTone("healthy")}><span><b>B</b> Avg. basket size</span><strong>{avgBasketSize.toFixed(1).replace(/\.0$/, "")}</strong><small>Items per paid order</small></article>
        <article className={metricTone(activeProducts > 0 ? "healthy" : "urgent")}><span><b>P</b> Active products</span><strong>{activeProducts}</strong><small>Visible storefront items</small></article>
      </section>

      <div className="admin-ops-grid dense">
        <div className="admin-ops-column">
        <section className="ops-panel orders-panel">
          <div className="ops-panel-head">
            <div><h2>Recent orders</h2><p>Payment, fulfillment, and timing at a glance.</p></div>
            <Link className="button secondary" href="/admin/orders">View orders</Link>
          </div>
          <div className="ops-order-list">
            {recentOrders.length === 0 ? <p className="dashboard-empty">Orders will appear here as customers check out.</p> : recentOrders.map((order) => {
              return (
              <article className="ops-order-row" key={order.id}>
                <div>
                  <div className="order-customer-cell">
                    <span className="customer-avatar">{initials(order.customerName)}</span>
                    <div>
                      <strong>{order.customerName}</strong>
                      <p>{order.id.slice(0, 10)}... · {order.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                      <p>{order.createdAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {titleCase(order.fulfillmentMethod.toLowerCase())}</p>
                      <p className="order-age">{minutesAgo(order.createdAt)}</p>
                    </div>
                  </div>
                </div>
                <div className="ops-order-meta">
                  <strong>{formatMoney(order.totalCents)}</strong>
                  <span className={`status-badge payment-${order.paymentStatus.toLowerCase()}`}>{paymentStatusLabel(order.paymentStatus)}</span>
                  <span className={`status-badge status-${order.status.toLowerCase()}`}>{orderStatusLabel(order.status, order.fulfillmentMethod)}</span>
                  <Link className="view-detail-link" href={`/admin/orders/${order.id}`}>View details</Link>
                </div>
              </article>
              )
            })}
          </div>
        </section>

        <section className="ops-panel analytics-panel">
          <div className="ops-panel-head"><div><h2>Sales snapshot</h2><p>Revenue and order activity over the last week.</p></div></div>
          <div className="sales-chart-card upgraded">
            <div className="sales-chart-head">
              <span>7-day revenue</span>
              <strong>{formatMoney(sevenDaySales.reduce((sum, item) => sum + item.total, 0))}</strong>
              <small>{hasSalesData ? `${trend(todaySales, previousSales)} revenue / ${trend(todayOrderCount, previousOrderCount)} orders` : "No sales data available"}</small>
            </div>
            {hasSalesData ? (
              <>
                <div className="sales-chart-stage">
                  <svg className="sales-line" viewBox="0 0 100 90" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                      <linearGradient id="salesLineGradient" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#facc15" />
                      </linearGradient>
                      <linearGradient id="salesAreaGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#salesAreaGradient)" />
                    <path d={linePath} fill="none" stroke="url(#salesLineGradient)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" />
                  </svg>
                  <div className="sales-bars" aria-label="Seven day sales trend">
                    {sevenDaySales.map((item) => (
                      <div className="sales-bar" key={item.day} title={`${item.day}: ${formatMoney(item.total)} / ${item.orders} orders`}>
                        <span style={{ height: `${Math.max(8, (item.total / maxSales) * 100)}%` }} />
                        <em style={{ height: `${Math.max(8, (item.orders / maxOrders) * 100)}%` }} />
                        <small>{item.day}</small>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="chart-foot">
                  <span>Busiest day: <strong>{busiestDay?.day ?? "N/A"}</strong></span>
                  <span>Peak revenue: <strong>{formatMoney(busiestDay?.total ?? 0)}</strong></span>
                </div>
                <div className="sales-legend"><span><i /> Revenue/day</span><span><i /> Orders/day</span></div>
              </>
            ) : (
              <div className="dashboard-empty">No sales data available.</div>
            )}
          </div>
          <div className="analytics-list dense-analytics">
            <div><strong>Conversion summary</strong><p>{validPaidOrders.length} paid checkouts from {allOrders.length} recent orders</p></div>
            <div><strong>Repeat customers</strong><p>{repeatRate}%</p></div>
            <div><strong>Avg. fulfillment time</strong><p>{avgFulfillmentLabel}</p></div>
            <div><strong>Pickup vs delivery</strong><p>{Math.round((pickupOrders / fulfillmentTotal) * 100)}% pickup / {Math.round((deliveryOrders / fulfillmentTotal) * 100)}% delivery</p></div>
            <div><strong>Top selling category</strong><p>{topSellingCategory}</p></div>
          </div>
        </section>

        <section className="ops-panel inventory-panel">
          <div className="ops-panel-head">
            <div><h2>Inventory watchlist</h2><p>Low stock progress and sold-out alerts.</p></div>
            <Link className="button secondary" href="/admin/products">Manage</Link>
          </div>
          <div className="inventory-list">
            {[...soldOutProducts, ...lowStockWatchlist].length === 0 ? <p className="dashboard-empty">Inventory looks healthy right now.</p> : [...soldOutProducts, ...lowStockWatchlist].slice(0, 8).map((product) => {
              const isOut = product.stock <= 0
              return (
                <article className="inventory-row" key={product.id}>
                  <div><strong>{product.name}</strong><p>{product.category.name} - {formatQuantity(Math.max(product.stock, 0), product.saleUnit)} left</p></div>
                  <div className="stock-progress-wrap">
                    <span className={`stock-state ${isOut ? "urgent" : "low"}`}>{isOut ? "Sold out" : "Low stock"}</span>
                    <div className="stock-progress"><span style={{ width: `${isOut ? 2 : stockPercent(product.stock, product.lowStockThreshold)}%` }} /></div>
                    <Link className="restock-link" href="/admin/inventory">Restock</Link>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="ops-panel best-sellers-panel">
          <div className="ops-panel-head"><div><h2>Best selling products</h2><p>Paid order volume by item.</p></div></div>
          <div className="best-seller-list">
            {topSellingProducts.length === 0 ? (
              <p className="dashboard-empty">No product sales yet.</p>
            ) : topSellingProducts.map((item, index) => (
              <article className="best-seller-row" key={item.name}>
                <img alt="" src={item.imageUrl} />
                <div><strong>{item.name}</strong><p>#{index + 1} - {item.quantitySold.toFixed(1).replace(/\.0$/, "")} sold - {item.orderCount} orders - {formatMoney(item.revenueCents)}</p></div>
              </article>
            ))}
          </div>
        </section>
        </div>

        <div className="admin-ops-column">
          <aside className="ops-panel quick-actions-panel">
            <div className="ops-panel-head"><div><h2>Quick actions</h2><p>Common store tasks.</p></div></div>
            <div className="quick-action-grid">
              <Link href="/admin/products">Add product</Link>
              <Link href="/admin/discounts">Create discount</Link>
              <Link href="/admin/orders">View orders</Link>
              <Link href="/admin/inventory">Restock inventory</Link>
            </div>
          </aside>

          <section className="ops-panel queue-panel">
            <div className="ops-panel-head"><div><h2>Grocery queues</h2><p>Ready, pickup, and delivery work.</p></div></div>
            <div className="queue-grid">
              {[
                ["Delivery queue", deliveryQueue],
                ["Pickup queue", pickupQueue],
                ["Ready now", readyNowQueue]
              ].map(([label, queue]) => (
                <div className="queue-card" key={String(label)}>
                  <strong>{String(label)}</strong>
                  {(queue as typeof allOrders).length === 0 ? (
                    <p>No orders waiting.</p>
                  ) : (queue as typeof allOrders).map((order) => (
                    <span key={order.id}>{order.customerName} · {orderStatusLabel(order.status, order.fulfillmentMethod)}</span>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section className="ops-panel fulfillment-panel">
            <div className="ops-panel-head"><div><h2>Fulfillment overview</h2><p>Work queue by status.</p></div></div>
            <div className="fulfillment-list">
              {[
                ["Received", receivedCount, "healthy"],
                ["Confirmed", confirmedCount, "healthy"],
                ["Preparing", preparingCount, "low"],
                ["Ready for pickup", readyCount, "healthy"],
                ["Out for delivery", outForDeliveryCount, "healthy"],
                ["Delivered", deliveredCount, "healthy"],
                ["Cancelled", cancelledCount, "urgent"]
              ].map(([label, count, tone]) => (
                <div className="fulfillment-row" key={label}>
                  <span>{label}</span>
                  <div className="fulfillment-meter"><i className={String(tone)} style={{ width: `${Math.max(5, (Number(count) / Math.max(fulfillmentOverviewTotal, 1)) * 100)}%` }} /></div>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="ops-panel activity-panel">
            <div className="ops-panel-head"><div><h2>Operational activity</h2><p>Recent store events and alerts.</p></div></div>
            <div className="activity-feed">
              {operationalEvents.length === 0 ? (
                <p className="dashboard-empty">No recent operational activity.</p>
              ) : operationalEvents.map((event) => (
                <p key={event.id}>
                  <span className={operationalEventTone(event.type)} />
                  <i className="activity-icon">{operationalEventIcon(event.type)}</i>
                  <strong>{event.message}</strong>
                  <small>{event.createdAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</small>
                </p>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
