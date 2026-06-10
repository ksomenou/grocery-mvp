import type { Order, OrderItem } from "@prisma/client"

import { formatLineItem, formatMoney, titleCase } from "@/lib/format"
import { logError, logInfo } from "@/lib/log"
import { createOperationalEvent } from "@/lib/operational-events"
import { prisma } from "@/lib/prisma"
import { formatSchedule } from "@/lib/scheduling"
import { storeName } from "@/lib/store"

type OrderWithItems = Order & { items: OrderItem[] }
type RefundNoticeOrder = OrderWithItems & {
  refunds: RefundNoticeRow[]
}

type RefundNoticeRow = {
  refundAmountCents: number
  refundReason: string
  refundedAt: Date
}

function configured(value?: string | null) {
  return Boolean(value && value.trim() && !value.includes("replace_me") && !value.includes("change-me"))
}

function emailConfigState(to?: string | null) {
  return {
    hasResendApiKey: configured(process.env.RESEND_API_KEY),
    hasEmailFrom: configured(process.env.EMAIL_FROM),
    hasRecipient: configured(to),
    emailFrom: process.env.EMAIL_FROM,
    recipient: to
  }
}

function orderLines(order: OrderWithItems) {
  return order.items
    .map((item) => `- ${formatLineItem(item.productName, item.quantity, item.priceCents, item.saleUnit)}`)
    .join("\n")
}

function statusLabel(status: string) {
  if (status === "RECEIVED") {
    return "Received"
  }

  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function orderNotificationText(order: OrderWithItems) {
  const fulfillment = titleCase(order.fulfillmentMethod.toLowerCase())
  const schedule = formatSchedule(order.scheduledDate, order.scheduledWindow)

  return [
    `New paid order for ${storeName}`,
    "",
    `Order ID: ${order.id}`,
    `Customer: ${order.customerName}`,
    `Email: ${order.customerEmail}`,
    order.customerPhone ? `Phone: ${order.customerPhone}` : null,
    `Fulfillment: ${fulfillment}`,
    schedule ? `Scheduled: ${schedule}` : null,
    order.fulfillmentMethod === "DELIVERY" ? `Delivery address: ${order.deliveryAddress}` : "Pickup: In-store pickup",
    order.deliveryInstructions ? `Instructions: ${order.deliveryInstructions}` : null,
    "",
    "Items:",
    orderLines(order),
    "",
    `Subtotal: ${formatMoney(order.subtotalCents)}`,
    `Discount: -${formatMoney(order.discountCents)}`,
    `Tax: ${formatMoney(order.taxCents)}`,
    `Delivery fee: ${formatMoney(order.deliveryFeeCents)}`,
    `Total: ${formatMoney(order.totalCents)}`,
    `Payment status: ${titleCase(order.paymentStatus.toLowerCase())}`,
    `Order time: ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(order.createdAt)}`
  ]
    .filter(Boolean)
    .join("\n")
}

function customerConfirmationText(order: OrderWithItems) {
  const fulfillment = titleCase(order.fulfillmentMethod.toLowerCase())
  const schedule = formatSchedule(order.scheduledDate, order.scheduledWindow)

  return [
    `Thanks for your order from ${storeName}.`,
    "",
    `Order ID: ${order.id}`,
    `Customer: ${order.customerName}`,
    `Fulfillment: ${fulfillment}`,
    schedule ? `Scheduled: ${schedule}` : null,
    order.fulfillmentMethod === "DELIVERY" ? `Delivery address: ${order.deliveryAddress}` : "Pickup: In-store pickup",
    "",
    "Items:",
    orderLines(order),
    "",
    `Subtotal: ${formatMoney(order.subtotalCents)}`,
    order.discountCents > 0 ? `Discount: -${formatMoney(order.discountCents)}` : null,
    `Tax: ${formatMoney(order.taxCents)}`,
    `Delivery fee: ${formatMoney(order.deliveryFeeCents)}`,
    `Total: ${formatMoney(order.totalCents)}`,
    `Payment status: ${titleCase(order.paymentStatus.toLowerCase())}`
  ]
    .filter(Boolean)
    .join("\n")
}

async function adminNotificationEmail() {
  const envAdminEmail = process.env.ADMIN_EMAIL?.trim()
  if (configured(envAdminEmail)) {
    return envAdminEmail
  }

  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { email: true }
  })

  return adminUser?.email ?? null
}

async function sendAdminEmail(order: OrderWithItems) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  const to = await adminNotificationEmail()

  if (!configured(apiKey) || !configured(from) || !configured(to)) {
    logError("Admin email notification skipped because email provider is not configured.", new Error("Missing email configuration."), {
      orderId: order.id,
      ...emailConfigState(to)
    })
    return false
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject: `New paid grocery order: ${order.id}`,
      text: orderNotificationText(order)
    })
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Resend admin email failed with status ${response.status}: ${body}`)
  }

  logInfo("Admin new order email sent.", { orderId: order.id, to })
  return true
}

async function sendCustomerEmail(order: OrderWithItems) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  const to = order.customerEmail

  if (!configured(apiKey) || !configured(from) || !configured(to)) {
    logError("Customer order confirmation email skipped because email provider is not configured.", new Error("Missing email configuration."), {
      orderId: order.id,
      ...emailConfigState(to)
    })
    return false
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject: `Your ${storeName} order confirmation`,
      text: customerConfirmationText(order)
    })
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Resend customer email failed with status ${response.status}: ${body}`)
  }

  logInfo("Customer order confirmation email sent.", { orderId: order.id, to })
  return true
}

function customerStatusMessage(order: OrderWithItems) {
  const status = statusLabel(order.status).toLowerCase()

  if (order.status === "CONFIRMED") {
    return "We confirmed your grocery order and will start preparing it soon."
  }

  if (order.status === "PREPARING") {
    return "Your groceries are being prepared now."
  }

  if (order.status === "READY_FOR_PICKUP") {
    return "Your groceries are ready for pickup. Please bring your order ID when you arrive."
  }

  if (order.status === "OUT_FOR_DELIVERY") {
    return "Your groceries are out for delivery and headed your way."
  }

  if (order.status === "DELIVERED") {
    return "Your grocery order has been delivered. Thank you for shopping with us."
  }

  if (order.status === "CANCELLED") {
    return "Your grocery order has been cancelled. Please contact support if you have questions."
  }

  return `Your order is now ${status}.`
}

function customerStatusSubject(order: OrderWithItems) {
  if (order.status === "OUT_FOR_DELIVERY") return "Your order is now out for delivery"
  if (order.status === "READY_FOR_PICKUP") return "Your order is ready for pickup"
  if (order.status === "DELIVERED") return "Your order has been delivered"
  if (order.status === "CANCELLED") return "Your order has been cancelled"
  return `Your order is now ${statusLabel(order.status).toLowerCase()}`
}

function customerStatusText(order: OrderWithItems) {
  const schedule = formatSchedule(order.scheduledDate, order.scheduledWindow)

  return [
    `${storeName} order update`,
    "",
    `Order ID: ${order.id}`,
    `New status: ${statusLabel(order.status)}`,
    schedule ? `Schedule: ${schedule}` : null,
    "",
    customerStatusMessage(order)
  ].filter(Boolean).join("\n")
}

async function sendCustomerStatusEmail(order: OrderWithItems) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  const to = order.customerEmail

  if (!configured(apiKey) || !configured(from) || !configured(to)) {
    logError("Customer status email skipped because email provider is not configured.", new Error("Missing email configuration."), {
      orderId: order.id,
      status: order.status,
      ...emailConfigState(to)
    })
    return
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject: customerStatusSubject(order),
      text: customerStatusText(order)
    })
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Resend customer status email failed with status ${response.status}: ${body}`)
  }

  logInfo("Customer status update email sent.", { orderId: order.id, status: order.status, to })
}

function customerRefundText(order: RefundNoticeOrder, refundAmountCents: number, refundReason: string) {
  const schedule = formatSchedule(order.scheduledDate, order.scheduledWindow)
  const totalRefunded = order.refunds.reduce((sum, refund) => sum + refund.refundAmountCents, 0)

  return [
    `${storeName} refund confirmation`,
    "",
    `Order ID: ${order.id}`,
    `Refund amount: ${formatMoney(refundAmountCents)}`,
    `Total refunded for this order: ${formatMoney(totalRefunded)}`,
    `Order total: ${formatMoney(order.totalCents)}`,
    schedule ? `Schedule: ${schedule}` : null,
    refundReason ? `Reason: ${refundReason}` : null,
    "",
    "Approved refunds are sent back to the original payment method. Your bank or payment provider may take 5-10 business days to post the refund."
  ].filter(Boolean).join("\n")
}

async function sendCustomerRefundEmail(order: RefundNoticeOrder, refundAmountCents: number, refundReason: string) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  const to = order.customerEmail

  if (!configured(apiKey) || !configured(from) || !configured(to)) {
    logError("Customer refund email skipped because email provider is not configured.", new Error("Missing email configuration."), {
      orderId: order.id,
      ...emailConfigState(to)
    })
    return false
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject: `Your ${storeName} refund confirmation`,
      text: customerRefundText(order, refundAmountCents, refundReason)
    })
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`Resend customer refund email failed with status ${response.status}: ${body}`)
  }

  logInfo("Customer refund confirmation email sent.", { orderId: order.id, to })
  return true
}

async function notificationAlreadySent(orderId: string, kind: string) {
  try {
    const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM "OperationalEvent"
        WHERE "type" = 'notification_sent'
          AND "metadata" @> ${JSON.stringify({ orderId, kind })}::jsonb
      ) AS "exists"
    `

    return Boolean(rows[0]?.exists)
  } catch (error) {
    logError("Notification sent marker lookup failed; attempting email send.", error, { orderId, kind })
    return false
  }
}

async function markNotificationSent(orderId: string, kind: string) {
  await createOperationalEvent({
    type: "notification_sent",
    message: `Notification sent for order ${orderId}`,
    metadata: { orderId, kind }
  })
}

export async function notifyPaidOrder(orderId: string) {
  logInfo("Paid order notification flow started.", { orderId })
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true }
  })

  if (!order) {
    logError("Paid order notification skipped because order was not found.", new Error("Order not found."), { orderId })
    return
  }

  if (order.paymentStatus !== "PAID") {
    logInfo("Paid order notification skipped because order is not paid.", { orderId, paymentStatus: order.paymentStatus })
    return
  }

  const jobs = [
    {
      kind: "paid_customer_email",
      label: "customer email",
      send: () => sendCustomerEmail(order)
    },
    {
      kind: "paid_admin_email",
      label: "admin email",
      send: () => sendAdminEmail(order)
    }
  ]

  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      if (await notificationAlreadySent(orderId, job.kind)) {
        logInfo(`Paid order ${job.label} notification already sent.`, { orderId })
        return
      }

      const sent = await job.send()
      if (sent) {
        await markNotificationSent(orderId, job.kind)
        logInfo(`Paid order ${job.label} notification marked sent.`, { orderId, kind: job.kind })
      }
    })
  )

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const label = jobs[index]?.label ?? "email"
      logError(`Paid order ${label} notification failed.`, result.reason, { orderId })
    }
  })
}

export async function notifyOrderStatusChanged(orderId: string, previousStatus: string, nextStatus: string) {
  logInfo("Order status notification flow started.", { orderId, previousStatus, nextStatus })
  if (previousStatus === nextStatus) {
    return
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true }
  })

  if (!order) {
    logError("Order status notification skipped because order was not found.", new Error("Order not found."), { orderId, previousStatus, nextStatus })
    return
  }

  if (order.status !== nextStatus) {
    logInfo("Order status notification skipped because saved status does not match requested status.", {
      orderId,
      nextStatus,
      savedStatus: order.status
    })
    return
  }

  const results = await Promise.allSettled([sendCustomerStatusEmail(order)])

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const label = ["customer status email"][index]
      logError(`Order status ${label} notification failed.`, result.reason, { orderId, nextStatus, previousStatus })
    }
  })
}

export async function notifyOrderRefunded(orderId: string, refundAmountCents: number, refundReason: string) {
  logInfo("Order refund notification flow started.", { orderId, refundAmountCents })
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true }
  })

  if (!order) {
    logError("Refund notification skipped because order was not found.", new Error("Order not found."), { orderId })
    return
  }

  try {
    const refunds = await prisma.$queryRaw<RefundNoticeRow[]>`
      SELECT "refundAmountCents", "refundReason", "refundedAt"
      FROM "OrderRefund"
      WHERE "orderId" = ${orderId}
      ORDER BY "refundedAt" ASC
    `
    await sendCustomerRefundEmail({ ...order, refunds }, refundAmountCents, refundReason)
  } catch (error) {
    logError("Order refund customer email failed.", error, { orderId, refundAmountCents })
  }
}
