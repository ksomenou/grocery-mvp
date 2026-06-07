import { NextResponse } from "next/server"
import Stripe from "stripe"

import { logError, logInfo } from "@/lib/log"
import {
  markOrderPaidAndReduceStock,
  markOrderPaidAndReduceStockByPaymentIntent,
  markOrderPaymentFailedByPaymentIntent,
  markOrderPaymentFailedBySession,
  markOrderRefundedByPaymentIntent,
  markOrderRefundedBySession
} from "@/lib/orders"
import { prisma } from "@/lib/prisma"
import { getStripe } from "@/lib/stripe"

async function orderIdForPaymentIntent(paymentIntent: Stripe.PaymentIntent) {
  const metadataOrderId = paymentIntent.metadata?.orderId
  if (metadataOrderId) {
    return metadataOrderId
  }

  const order = await prisma.order.findFirst({
    where: { stripePaymentIntentId: paymentIntent.id },
    select: { id: true }
  })

  return order?.id
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 500 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 })
  }

  const body = await request.text()
  let event: Stripe.Event

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 })
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const orderId = await orderIdForPaymentIntent(paymentIntent)

      if (orderId) {
        await markOrderPaidAndReduceStockByPaymentIntent(orderId, paymentIntent.id)
        logInfo("Processed payment_intent.succeeded webhook.", { orderId, stripePaymentIntentId: paymentIntent.id })
      } else {
        logInfo("Payment intent succeeded without a matching order.", { stripePaymentIntentId: paymentIntent.id })
      }
    }

    if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      await markOrderPaymentFailedByPaymentIntent(paymentIntent.id)
      logInfo("Processed failed or canceled payment intent webhook.", { stripePaymentIntentId: paymentIntent.id, eventType: event.type })
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session
      const orderId = session.metadata?.orderId

      if (orderId && session.payment_status === "paid") {
        await markOrderPaidAndReduceStock(orderId, session.id)
        logInfo("Processed checkout.session.completed webhook.", { orderId, stripeSessionId: session.id })
      }
    }

    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session
      await markOrderPaymentFailedBySession(session.id)
      logInfo("Processed failed or expired checkout webhook.", { stripeSessionId: session.id, eventType: event.type })
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge
      if (typeof charge.payment_intent === "string") {
        await markOrderRefundedByPaymentIntent(charge.payment_intent)
        logInfo("Processed charge.refunded webhook by payment intent.", { stripePaymentIntentId: charge.payment_intent })
      }

      const checkoutSessions = await getStripe().checkout.sessions.list({
        payment_intent: typeof charge.payment_intent === "string" ? charge.payment_intent : undefined,
        limit: 1
      })
      const session = checkoutSessions.data[0]
      if (session?.id) {
        await markOrderRefundedBySession(session.id)
        logInfo("Processed charge.refunded webhook.", { stripeSessionId: session.id })
      }
    }
  } catch (error) {
    logError("Stripe webhook processing failed.", error, { eventType: event.type })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed." },
      { status: 500 }
    )
  }

  return NextResponse.json({ received: true })
}
