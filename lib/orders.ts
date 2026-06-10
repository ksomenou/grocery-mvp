import { PaymentStatus, type FulfillmentMethod } from "@prisma/client"
import { randomBytes } from "node:crypto"

import { logInfo } from "@/lib/log"
import { notifyPaidOrder } from "@/lib/notifications"
import { createOperationalEvent } from "@/lib/operational-events"
import { prisma } from "@/lib/prisma"

export const adminOrderStatuses = [
  "RECEIVED",
  "CONFIRMED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "PARTIALLY_REFUNDED",
  "REFUNDED"
] as const

export type FulfillmentStatus = (typeof adminOrderStatuses)[number]

const allowedTransitions: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  RECEIVED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "CANCELLED"],
  READY_FOR_PICKUP: ["DELIVERED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  PARTIALLY_REFUNDED: [],
  REFUNDED: []
}

export function createOrderAccessToken() {
  return randomBytes(24).toString("hex")
}

export function orderStatusLabel(status: string, fulfillmentMethod?: FulfillmentMethod | string) {
  if (status === "RECEIVED") {
    return "Received"
  }

  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function paymentStatusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function isFulfillmentStatus(value: unknown): value is FulfillmentStatus {
  return typeof value === "string" && adminOrderStatuses.includes(value as FulfillmentStatus)
}

export function assertValidOrderTransition(current: string, next: FulfillmentStatus, paymentStatus?: PaymentStatus) {
  if (!isFulfillmentStatus(current)) {
    throw new Error("Current order status is not supported.")
  }

  if (current === next) {
    return
  }

  if (paymentStatus !== PaymentStatus.PAID && next !== "CANCELLED") {
    throw new Error("Payment must be paid before fulfillment can begin.")
  }

  if (next === "REFUNDED") {
    throw new Error("Refunded orders are handled by payment refunds, not fulfillment updates.")
  }

  if (!allowedTransitions[current].includes(next)) {
    throw new Error(`Cannot move order from ${orderStatusLabel(current)} to ${orderStatusLabel(next)}.`)
  }
}

export function canTransitionOrderStatus(current: string, next: FulfillmentStatus, paymentStatus?: PaymentStatus) {
  try {
    assertValidOrderTransition(current, next, paymentStatus)
    return true
  } catch {
    return false
  }
}

type StripePaymentReference =
  | { type: "session"; id: string }
  | { type: "payment_intent"; id: string }

type PaidOrderFinalizeOptions = {
  repairCancelledPaid?: boolean
}

function stripeReferenceMetadata(reference: StripePaymentReference): Record<string, string> {
  return reference.type === "session"
    ? { stripeSessionId: reference.id }
    : { stripePaymentIntentId: reference.id }
}

async function markOrderPaidAndReduceStockWithReference(
  orderId: string,
  reference: StripePaymentReference,
  options: PaidOrderFinalizeOptions = {}
) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    })

    if (!order) {
      throw new Error("Order not found.")
    }

    if (reference.type === "session" && order.stripeSessionId && order.stripeSessionId !== reference.id) {
      throw new Error("Stripe session does not match this order.")
    }

    if (reference.type === "payment_intent" && order.stripePaymentIntentId !== reference.id) {
      throw new Error("Stripe payment intent does not match this order.")
    }

    if (order.paymentStatus === "REFUNDED" || order.status === "REFUNDED") {
      return { finalizedNow: false, order, stockEventItems: [] }
    }

    const claim = await tx.order.updateMany({
      where: {
        id: order.id,
        stockReduced: false,
        paymentStatus: { not: PaymentStatus.REFUNDED },
        status: { not: "REFUNDED" }
      },
      data: {
        paymentStatus: PaymentStatus.PAID,
        ...(reference.type === "session" ? { stripeSessionId: reference.id } : { stripePaymentIntentId: reference.id }),
        stockReduced: true,
        status: "RECEIVED",
        paidAt: new Date()
      }
    })

    if (claim.count === 0) {
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: PaymentStatus.PAID,
          ...(reference.type === "session" ? { stripeSessionId: reference.id } : { stripePaymentIntentId: reference.id }),
          ...(options.repairCancelledPaid && order.paymentStatus === PaymentStatus.PAID && order.stockReduced && order.status === "CANCELLED"
            ? { status: "RECEIVED" as const }
            : {}),
          ...(!order.stockReduced && order.status === "CANCELLED" ? { status: "RECEIVED" as const } : {}),
          paidAt: order.paidAt ?? new Date()
        }
      })
      return { finalizedNow: false, order: updatedOrder, stockEventItems: [] }
    }

    if (order.discountCode && order.discountCents > 0) {
      await tx.discountCode.updateMany({
        where: { code: order.discountCode },
        data: { redemptionCount: { increment: 1 } }
      })
    }

    for (const item of order.items) {
      const updated = await tx.product.updateMany({
        where: {
          id: item.productId,
          stock: { gte: item.quantity }
        },
        data: {
          stock: { decrement: item.quantity }
        }
      })

      if (updated.count === 0) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            stockReduced: false
          }
        })
        await tx.$executeRaw`
          UPDATE "Order"
          SET
            "status" = 'CANCELLED'::"OrderStatus",
            "updatedAt" = NOW()
          WHERE "id" = ${order.id}
        `
        throw new Error(`Insufficient stock for ${item.productName}.`)
      }
    }

    return {
      finalizedNow: true,
      order,
      stockEventItems: order.items.map((item) => ({
        productId: item.productId,
        productName: item.productName
      }))
    }
  })

  if (result.finalizedNow) {
    const products = await prisma.product.findMany({
      where: { id: { in: result.stockEventItems.map((item) => item.productId) } },
      select: { id: true, lowStockThreshold: true, stock: true }
    })
    const productById = new Map(products.map((product) => [product.id, product]))

    for (const item of result.stockEventItems) {
      const product = productById.get(item.productId)

      if (product && product.stock <= 0) {
        await createOperationalEvent({
          type: "product_sold_out",
          message: `Product sold out: ${item.productName}`,
          metadata: { orderId, productId: item.productId, productName: item.productName }
        })
      } else if (product && product.stock <= product.lowStockThreshold) {
        await createOperationalEvent({
          type: "low_stock_detected",
          message: `Low stock detected: ${item.productName}`,
          metadata: { orderId, productId: item.productId, productName: item.productName, stock: product.stock }
        })
      }
    }

    await createOperationalEvent({
      type: "payment_succeeded",
      message: `Payment confirmed for order ${result.order.id}`,
      metadata: { orderId, ...stripeReferenceMetadata(reference) }
    })

    logInfo("Stripe payment finalized and inventory reduced.", { orderId, ...stripeReferenceMetadata(reference) })
  }

  if (result.finalizedNow || result.order.paymentStatus === PaymentStatus.PAID) {
    await notifyPaidOrder(result.order.id)
  }

  return result.order
}

export async function markOrderPaidAndReduceStock(orderId: string, stripeSessionId: string) {
  return markOrderPaidAndReduceStockWithReference(orderId, { type: "session", id: stripeSessionId })
}

export async function markOrderPaidAndReduceStockByPaymentIntent(
  orderId: string,
  stripePaymentIntentId: string,
  options?: PaidOrderFinalizeOptions
) {
  return markOrderPaidAndReduceStockWithReference(orderId, { type: "payment_intent", id: stripePaymentIntentId }, options)
}

export async function markOrderPaymentFailedBySession(stripeSessionId: string) {
  const order = await prisma.order.findFirst({
    where: {
      stripeSessionId,
      paymentStatus: PaymentStatus.PENDING
    }
  })

  if (!order) {
    return
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: PaymentStatus.FAILED
    }
  })
  await prisma.$executeRaw`
    UPDATE "Order"
    SET
      "status" = 'CANCELLED'::"OrderStatus",
      "updatedAt" = NOW()
    WHERE "id" = ${order.id}
  `
  await createOperationalEvent({
    type: "payment_failed",
    message: `Payment failed for order ${order.id}`,
    metadata: { orderId: order.id, stripeSessionId }
  })
}

export async function markOrderPaymentFailedByPaymentIntent(stripePaymentIntentId: string) {
  const order = await prisma.order.findFirst({
    where: {
      stripePaymentIntentId,
      paymentStatus: PaymentStatus.PENDING
    }
  })

  if (!order) {
    return
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: PaymentStatus.FAILED
    }
  })
  await prisma.$executeRaw`
    UPDATE "Order"
    SET
      "status" = 'CANCELLED'::"OrderStatus",
      "updatedAt" = NOW()
    WHERE "id" = ${order.id}
  `
  await createOperationalEvent({
    type: "payment_failed",
    message: `Payment failed for order ${order.id}`,
    metadata: { orderId: order.id, stripePaymentIntentId }
  })
}

export async function markOrderRefundedBySession(stripeSessionId: string) {
  const order = await prisma.order.findFirst({
    where: {
      stripeSessionId,
      paymentStatus: PaymentStatus.PAID
    },
    include: { items: true }
  })

  if (!order) {
    return
  }

  await prisma.$transaction(async (tx) => {
    if (order.stockReduced) {
      const releaseClaim = await tx.order.updateMany({
        where: { id: order.id, stockReduced: true },
        data: { stockReduced: false }
      })

      if (releaseClaim.count > 0) {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } }
          })
        }
      }
    }

    await tx.$executeRaw`
      UPDATE "Order"
      SET
        "paymentStatus" = 'REFUNDED'::"PaymentStatus",
        "status" = 'REFUNDED'::"OrderStatus",
        "updatedAt" = NOW()
      WHERE "id" = ${order.id}
    `
  })

  await createOperationalEvent({
    type: "refund_processed",
    message: `Refund processed for order ${order.id}`,
    metadata: { orderId: order.id, stripeSessionId }
  })
}

export async function markOrderRefundedByPaymentIntent(stripePaymentIntentId: string) {
  const order = await prisma.order.findFirst({
    where: {
      stripePaymentIntentId,
      paymentStatus: PaymentStatus.PAID
    },
    include: { items: true }
  })

  if (!order) {
    return
  }

  await prisma.$transaction(async (tx) => {
    if (order.stockReduced) {
      const releaseClaim = await tx.order.updateMany({
        where: { id: order.id, stockReduced: true },
        data: { stockReduced: false }
      })

      if (releaseClaim.count > 0) {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } }
          })
        }
      }
    }

    await tx.$executeRaw`
      UPDATE "Order"
      SET
        "paymentStatus" = 'REFUNDED'::"PaymentStatus",
        "status" = 'REFUNDED'::"OrderStatus",
        "updatedAt" = NOW()
      WHERE "id" = ${order.id}
    `
  })

  await createOperationalEvent({
    type: "refund_processed",
    message: `Refund processed for order ${order.id}`,
    metadata: { orderId: order.id, stripePaymentIntentId }
  })
}
