import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/admin-auth"
import { formatMoney } from "@/lib/format"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    await requireAdmin()
    const order = await prisma.order.findFirst({
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
