import { NextResponse } from "next/server"

import { assertStripeConfigured, calculateCheckout, checkoutSchema, checkoutValidationMessage, isDatabaseError } from "@/lib/checkout"
import { logError } from "@/lib/log"
import { getStripe } from "@/lib/stripe"

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 })
  }

  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: checkoutValidationMessage(parsed.error) }, { status: 400 })
  }

  try {
    assertStripeConfigured()
    const checkout = await calculateCheckout(parsed.data)

    const paymentIntent = await getStripe().paymentIntents.create({
      amount: checkout.totalCents,
      currency: "usd",
      description: "Grocery checkout payment",
      metadata: { checkoutStatus: "payment_fields_loaded" },
      payment_method_types: ["card"],
      receipt_email: parsed.data.customerEmail
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    })
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[checkout]", error)
    }
    logError("Checkout session creation failed.", error)
    if (isDatabaseError(error)) {
      return NextResponse.json({ error: "Database error. Please try again." }, { status: 500 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed." },
      { status: 400 }
    )
  }
}
