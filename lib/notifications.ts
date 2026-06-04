import type { Order, OrderItem } from "@prisma/client"

import { formatLineItem, formatMoney, titleCase } from "@/lib/format"
import { logError, logInfo } from "@/lib/log"
import { prisma } from "@/lib/prisma"
import { formatSchedule } from "@/lib/scheduling"
import { storeName } from "@/lib/store"

type OrderWithItems = Order & { items: OrderItem[] }

function configured(value?: string) {
  return Boolean(value && value.trim() && !value.includes("replace_me") && !value.includes("change-me"))
}

function orderLines(order: OrderWithItems) {
  return order.items
    .map((item) => `- ${formatLineItem(item.productName, item.quantity, item.priceCents, item.saleUnit)}`)
    .join("\n")
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
    `Delivery fee: ${formatMoney(order.deliveryFeeCents)}`,
    `Total: ${formatMoney(order.totalCents)}`,
    `Payment status: ${titleCase(order.paymentStatus.toLowerCase())}`,
    `Order time: ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(order.createdAt)}`
  ]
    .filter(Boolean)
    .join("\n")
}

async function sendAdminEmail(order: OrderWithItems) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  const to = process.env.ADMIN_EMAIL

  if (!configured(apiKey) || !configured(from) || !configured(to)) {
    logInfo("Admin email notification skipped because email provider is not configured.", { orderId: order.id })
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
      subject: `New paid grocery order: ${order.id}`,
      text: orderNotificationText(order)
    })
  })

  if (!response.ok) {
    throw new Error(`Resend email failed with status ${response.status}.`)
  }
}

async function sendSms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const token = process.env.TWILIO_AUTH_TOKEN?.trim()
  const from = process.env.TWILIO_PHONE_NUMBER?.trim()

  if (!configured(sid) || !configured(token) || !configured(from)) {
    return false
  }

  const accountSid = sid as string
  const authToken = token as string
  const fromNumber = from as string

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ Body: body, From: fromNumber, To: to })
  })

  if (!response.ok) {
    throw new Error(`Twilio SMS failed with status ${response.status}.`)
  }

  return true
}

async function sendAdminSms(order: OrderWithItems) {
  const adminPhone = process.env.ADMIN_PHONE_NUMBER?.trim()
  if (!configured(adminPhone)) {
    logInfo("Admin SMS notification skipped because ADMIN_PHONE_NUMBER is not configured.", { orderId: order.id })
    return
  }

  const fulfillment = order.fulfillmentMethod === "DELIVERY" ? "Delivery" : "Pickup"
  const window = order.scheduledWindow ?? "No window"
  const sent = await sendSms(
    adminPhone as string,
    `New order received: ${order.id} - ${order.customerName} - ${formatMoney(order.totalCents)} - ${fulfillment} - ${window}`
  )

  if (!sent) {
    logInfo("Admin SMS notification skipped because SMS provider is not configured.", { orderId: order.id })
  }
}

async function sendCustomerSms(order: OrderWithItems) {
  if (!order.customerPhone) {
    return
  }

  const sent = await sendSms(
    order.customerPhone,
    `Thanks for your order from ${storeName}. Order ${order.id} received.`
  )

  if (!sent) {
    logInfo("Customer SMS notification skipped because SMS provider is not configured.", { orderId: order.id })
  }
}

export async function notifyPaidOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true }
  })

  if (!order) {
    return
  }

  const results = await Promise.allSettled([
    sendAdminEmail(order),
    sendAdminSms(order),
    sendCustomerSms(order)
  ])

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const label = ["admin email", "admin SMS", "customer SMS"][index]
      logError(`Paid order ${label} notification failed.`, result.reason, { orderId })
    }
  })
}
