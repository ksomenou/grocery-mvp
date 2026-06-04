import { NextResponse } from "next/server"
import Stripe from "stripe"

import { logError, logInfo } from "@/lib/log"
import { markOrderPaidAndReduceStock, markOrderPaymentFailedBySession, markOrderRefundedBySession } from "@/lib/orders"
import { getStripe } from "@/lib/stripe"

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
