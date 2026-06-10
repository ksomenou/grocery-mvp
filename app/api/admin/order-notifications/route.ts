import { NextResponse } from "next/server"

import { requirePermission } from "@/lib/admin-auth"
import { formatMoney } from "@/lib/format"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    await requirePermission("orders:view")
    const order = await prisma.order.findFirst({
      where: {
        paymentStatus: "PAID",
        status: { notIn: ["CANCELLED", "REFUNDED"] }
      },
      orderBy: { createdAt: "desc" },
      select: {
        customerName: true,
        fulfillmentMethod: true,
        id: true,
        totalCents: true
      }
    })

    return NextResponse.json({
      latestOrderId: order?.id ?? null,
      latestOrderLabel: order
        ? `New order received: ${order.customerName} - ${formatMoney(order.totalCents)} - ${order.fulfillmentMethod === "DELIVERY" ? "Delivery" : "Pickup"}`
        : null
    })
  } catch {
    return NextResponse.json({ error: "You do not have permission to perform this action." }, { status: 401 })
  }
}
