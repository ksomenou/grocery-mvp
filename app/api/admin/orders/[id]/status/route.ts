import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/admin-auth"
import { orderStatusLabel, paymentStatusLabel } from "@/lib/orders"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: "Order ID is required." }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        fulfillmentMethod: true,
        id: true,
        paymentStatus: true,
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
      isTerminal: order.status === "DELIVERED" || order.status === "CANCELLED" || order.status === "REFUNDED",
      paymentLabel: paymentStatusLabel(order.paymentStatus),
      paymentStatus: order.paymentStatus,
      status: order.status,
      statusLabel: orderStatusLabel(order.status, order.fulfillmentMethod),
      updatedAt: order.updatedAt.toISOString()
    })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
