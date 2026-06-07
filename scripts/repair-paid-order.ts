import { getStripe } from "../lib/stripe"
import { markOrderPaidAndReduceStockByPaymentIntent } from "../lib/orders"
import { prisma } from "../lib/prisma"

const defaultOrderId = "cmq3ynsvd00039niurzu3go7s"

async function main() {
  const orderId = process.argv[2] ?? process.env.REPAIR_ORDER_ID ?? defaultOrderId

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      paymentStatus: true,
      status: true,
      stockReduced: true,
      stripePaymentIntentId: true,
      totalCents: true
    }
  })

  if (!order) {
    throw new Error(`Order ${orderId} was not found.`)
  }

  if (!order.stripePaymentIntentId) {
    throw new Error(`Order ${order.id} does not have a Stripe PaymentIntent ID.`)
  }

  const paymentIntent = await getStripe().paymentIntents.retrieve(order.stripePaymentIntentId)

  if (paymentIntent.status !== "succeeded") {
    throw new Error(`Stripe PaymentIntent ${paymentIntent.id} is ${paymentIntent.status}, not succeeded.`)
  }

  if (paymentIntent.currency.toLowerCase() !== "usd") {
    throw new Error(`Stripe PaymentIntent ${paymentIntent.id} currency is ${paymentIntent.currency}, not usd.`)
  }

  if (paymentIntent.amount_received !== order.totalCents) {
    throw new Error(
      `Stripe amount ${paymentIntent.amount_received} does not match order total ${order.totalCents}.`
    )
  }

  if (paymentIntent.metadata?.orderId && paymentIntent.metadata.orderId !== order.id) {
    throw new Error(
      `Stripe PaymentIntent metadata orderId ${paymentIntent.metadata.orderId} does not match ${order.id}.`
    )
  }

  if (order.paymentStatus === "PAID" && order.stockReduced && order.status !== "CANCELLED") {
    console.log(
      `[repair paid order] Order ${order.id} is already repaired: paymentStatus=${order.paymentStatus}, status=${order.status}, stockReduced=${order.stockReduced}.`
    )
    return
  }

  await markOrderPaidAndReduceStockByPaymentIntent(order.id, paymentIntent.id, {
    repairCancelledPaid: true
  })

  const repaired = await prisma.order.findUnique({
    where: { id: order.id },
    select: {
      id: true,
      paidAt: true,
      paymentStatus: true,
      status: true,
      stockReduced: true,
      totalCents: true
    }
  })

  console.log("[repair paid order] Repair complete:", repaired)
}

main()
  .catch((error) => {
    console.error("[repair paid order failed]", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
