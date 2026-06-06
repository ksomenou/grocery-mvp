import { prisma } from "@/lib/prisma"
import { randomBytes } from "node:crypto"

export type OperationalEventType =
  | "payment_succeeded"
  | "payment_failed"
  | "order_status_updated"
  | "inventory_restocked"
  | "low_stock_detected"
  | "refund_processed"
  | "discount_created"
  | "product_created"
  | "product_sold_out"

export async function createOperationalEvent({
  type,
  message,
  metadata
}: {
  type: OperationalEventType
  message: string
  metadata?: Record<string, string | number | boolean | null>
}) {
  try {
    await prisma.$executeRaw`
      INSERT INTO "OperationalEvent" ("id", "type", "message", "metadata", "createdAt")
      VALUES (
        ${`event_${randomBytes(12).toString("hex")}`},
        ${type},
        ${message},
        ${metadata ? JSON.stringify(metadata) : null}::jsonb,
        NOW()
      )
    `
  } catch {
    // Operational event logging should never block checkout, inventory, or admin workflows.
  }
}

export type OperationalEventRow = {
  id: string
  type: string
  message: string
  createdAt: Date
}

export async function getRecentOperationalEvents(limit = 20) {
  try {
    return await prisma.$queryRaw<OperationalEventRow[]>`
      SELECT "id", "type", "message", "createdAt"
      FROM "OperationalEvent"
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `
  } catch {
    return []
  }
}

export function operationalEventTone(type: string) {
  if (type === "product_sold_out" || type === "refund_processed" || type === "payment_failed") {
    return "urgent"
  }

  if (type === "low_stock_detected" || type === "discount_created" || type === "inventory_restocked") {
    return "low"
  }

  return "healthy"
}

export function operationalEventIcon(type: string) {
  const icons: Record<string, string> = {
    payment_succeeded: "PM",
    payment_failed: "PF",
    order_status_updated: "OS",
    inventory_restocked: "RS",
    low_stock_detected: "LS",
    refund_processed: "RF",
    discount_created: "DS",
    product_created: "PR",
    product_sold_out: "SO"
  }

  return icons[type] ?? "EV"
}
