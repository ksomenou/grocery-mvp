"use server"

import { PaymentStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { randomBytes } from "node:crypto"
import { z } from "zod"

import type { ActionState } from "@/lib/actions"
import { requirePermission } from "@/lib/admin-auth"
import { formatMoney } from "@/lib/format"
import { logError, logInfo } from "@/lib/log"
import { notifyOrderRefunded } from "@/lib/notifications"
import { createOperationalEvent } from "@/lib/operational-events"
import { prisma } from "@/lib/prisma"
import { getStripe } from "@/lib/stripe"

const refundSchema = z.object({
  amount: z.coerce.number().min(0, "Refund amount cannot be negative.").optional(),
  reason: z.string().trim().min(3, "Enter a refund reason."),
  type: z.enum(["FULL", "PARTIAL"], { errorMap: () => ({ message: "Choose a refund type." }) })
})

export async function refundOrder(orderId: string, _state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission("refunds:create")
    const data = refundSchema.parse({
      amount: formData.get("amount"),
      reason: formData.get("reason"),
      type: formData.get("type")
    })

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    })

    if (!order) {
      return { ok: false, message: "Order was not found." }
    }

    if (order.paymentStatus !== PaymentStatus.PAID) {
      return { ok: false, message: "Only paid orders can be refunded." }
    }

    const refundRows = await prisma.$queryRaw<{ total: number | bigint | null }[]>`
      SELECT COALESCE(SUM("refundAmountCents"), 0) AS total
      FROM "OrderRefund"
      WHERE "orderId" = ${order.id}
    `
    const alreadyRefundedCents = Number(refundRows[0]?.total ?? 0)
    const remainingCents = Math.max(0, order.totalCents - alreadyRefundedCents)
    if (remainingCents <= 0) {
      return { ok: false, message: "This order has already been fully refunded." }
    }

    const requestedCents = data.type === "FULL" ? remainingCents : Math.round((data.amount ?? 0) * 100)
    if (requestedCents <= 0) {
      return { ok: false, message: "Enter a refund amount greater than $0.00." }
    }

    if (requestedCents > remainingCents) {
      return { ok: false, message: `Refund cannot exceed the remaining paid amount of ${formatMoney(remainingCents)}.` }
    }

    const paymentIntentId = await resolvePaymentIntentId(order.stripePaymentIntentId, order.stripeSessionId)
    if (!paymentIntentId) {
      return { ok: false, message: "This order does not have a Stripe payment reference to refund." }
    }

    const stripeRefund = await getStripe().refunds.create({
      amount: requestedCents,
      metadata: {
        orderId: order.id,
        refundReason: data.reason,
        refundedBy: user.email
      },
      payment_intent: paymentIntentId,
      reason: "requested_by_customer"
    })

    const nextTotalRefundedCents = alreadyRefundedCents + requestedCents
    const isFullRefund = nextTotalRefundedCents >= order.totalCents
    const refundedBy = `${user.name} <${user.email}>`
    const refundRecordId = `refund_${randomBytes(12).toString("hex")}`

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "OrderRefund" (
          "id",
          "orderId",
          "stripeRefundId",
          "refundAmountCents",
          "refundReason",
          "refundedAt",
          "refundedBy"
        ) VALUES (
          ${refundRecordId},
          ${order.id},
          ${stripeRefund.id},
          ${requestedCents},
          ${data.reason},
          NOW(),
          ${refundedBy}
        )
      `

      if (isFullRefund) {
        await tx.$executeRaw`
          UPDATE "Order"
          SET
            "paymentStatus" = 'REFUNDED'::"PaymentStatus",
            "status" = 'REFUNDED'::"OrderStatus",
            "updatedAt" = NOW()
          WHERE "id" = ${order.id}
        `
      } else {
        await tx.$executeRaw`
          UPDATE "Order"
          SET
            "status" = 'PARTIALLY_REFUNDED'::"OrderStatus",
            "updatedAt" = NOW()
          WHERE "id" = ${order.id}
        `
      }
    })

    await createOperationalEvent({
      type: "refund_processed",
      message: `${isFullRefund ? "Full" : "Partial"} refund processed for order ${order.id}`,
      metadata: {
        orderId: order.id,
        refundAmountCents: requestedCents,
        stripeRefundId: stripeRefund.id
      }
    })

    await notifyOrderRefunded(order.id, requestedCents, data.reason)
    logInfo("Admin refund processed.", { orderId: order.id, refundAmountCents: requestedCents, stripeRefundId: stripeRefund.id })

    revalidatePath("/admin")
    revalidatePath("/admin/orders")
    revalidatePath(`/admin/orders/${order.id}`)
    return { ok: true, message: `${isFullRefund ? "Full" : "Partial"} refund processed.` }
  } catch (error) {
    logError("Admin refund failed.", error, { orderId })
    return actionError(error, "Could not process refund.")
  }
}

async function resolvePaymentIntentId(stripePaymentIntentId?: string | null, stripeSessionId?: string | null) {
  if (stripePaymentIntentId) {
    return stripePaymentIntentId
  }

  if (!stripeSessionId) {
    return null
  }

  const session = await getStripe().checkout.sessions.retrieve(stripeSessionId)
  return typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null
}

function actionError(error: unknown, fallback: string): ActionState {
  if (error instanceof z.ZodError) {
    const message = error.issues.map((issue) => issue.message).filter(Boolean).join(" ")
    return { ok: false, message: message || "Please check the refund form." }
  }

  if (error instanceof Error) {
    return { ok: false, message: error.message || fallback }
  }

  return { ok: false, message: fallback }
}
