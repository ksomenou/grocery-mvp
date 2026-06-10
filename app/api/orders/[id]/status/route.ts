import { NextResponse } from "next/server"

import { orderStatusLabel, paymentStatusLabel } from "@/lib/orders"
import { prisma } from "@/lib/prisma"
import { formatSchedule } from "@/lib/scheduling"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = new URL(request.url).searchParams.get("token")?.trim()

  if (!id || !token) {
    return NextResponse.json({ error: "Order link is required." }, { status: 400 })
  }

  const order = await prisma.order.findFirst({
    where: { accessToken: token, id },
    select: {
      fulfillmentMethod: true,
      id: true,
      paymentStatus: true,
      scheduledDate: true,
      scheduledWindow: true,
      status: true,
      updatedAt: true
    }
  })

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 })
  }

  return NextResponse.json({
    fulfillmentMethod: order.fulfillmentMethod,
    id: order.id,
    isTerminal: order.status === "DELIVERED" || order.status === "CANCELLED" || order.status === "PARTIALLY_REFUNDED" || order.status === "REFUNDED",
    paymentLabel: paymentStatusLabel(order.paymentStatus),
    paymentStatus: order.paymentStatus,
    schedule: formatSchedule(order.scheduledDate, order.scheduledWindow),
    status: order.status,
    statusLabel: orderStatusLabel(order.status, order.fulfillmentMethod),
    updatedAt: order.updatedAt.toISOString()
  })
}
