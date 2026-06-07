import { NextResponse } from "next/server"
import { z } from "zod"

import { getCurrentUser } from "@/lib/auth"
import { assertStripeConfigured, calculateCheckout, checkoutSchema, checkoutValidationMessage, isDatabaseError } from "@/lib/checkout"
import { logError } from "@/lib/log"
import { createOrderAccessToken } from "@/lib/orders"
import { prisma } from "@/lib/prisma"
import { getStripe } from "@/lib/stripe"

const submitCheckoutSchema = checkoutSchema.extend({
  paymentIntentId: z.string().min(1, "Payment could not be prepared.")
})

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 })
  }

  const parsed = submitCheckoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: checkoutValidationMessage(parsed.error) }, { status: 400 })
  }

  try {
    assertStripeConfigured()
    const { paymentIntentId, ...checkoutInput } = parsed.data
    const checkout = await calculateCheckout(checkoutInput)
    const currentUser = await getCurrentUser()
    const stripe = getStripe()
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== "requires_payment_method" && paymentIntent.status !== "requires_confirmation") {
      throw new Error("Payment is no longer ready. Please refresh checkout and try again.")
    }

    if (paymentIntent.metadata?.orderId) {
      const existingOrder = await prisma.order.findUnique({
        where: { id: paymentIntent.metadata.orderId },
        select: { accessToken: true, id: true }
      })

      if (existingOrder) {
        return NextResponse.json({
          clientSecret: paymentIntent.client_secret,
          orderId: existingOrder.id,
          token: existingOrder.accessToken
        })
      }
    }

    const order = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { email: checkoutInput.customerEmail.toLowerCase() },
        update: { name: checkoutInput.customerName },
        create: {
          email: checkoutInput.customerEmail.toLowerCase(),
          name: checkoutInput.customerName
        }
      })

      const created = await tx.order.create({
        data: {
          accessToken: createOrderAccessToken(),
          userId: currentUser?.role === "CUSTOMER" ? currentUser.id : null,
          customerId: customer.id,
          customerName: checkoutInput.customerName,
          customerEmail: customer.email,
          customerPhone: checkout.customerPhone,
          status: "CANCELLED",
          paymentStatus: "PENDING",
          fulfillmentMethod: checkoutInput.fulfillmentMethod,
          deliveryAddress:
            checkoutInput.fulfillmentMethod === "DELIVERY"
              ? checkoutInput.deliveryAddress?.trim() ?? ""
              : "Pickup at store",
          deliveryInstructions:
            checkoutInput.fulfillmentMethod === "DELIVERY"
              ? checkoutInput.deliveryInstructions?.trim() || null
              : null,
          deliveryWindow: checkout.deliveryWindow,
          scheduledDate: checkout.scheduledDate,
          scheduledWindow: checkout.scheduledWindow,
          subtotalCents: checkout.subtotalCents,
          discountCode: checkout.discount?.code ?? null,
          discountCents: checkout.discountCents,
          taxCents: checkout.taxCents,
          deliveryFeeCents: checkout.feeCents,
          totalCents: checkout.totalCents,
          stripePaymentIntentId: paymentIntentId,
          items: {
            create: checkout.orderItems.map((item) => ({
              productId: item.product.id,
              quantity: item.quantity,
              priceCents: item.priceCents,
              saleUnit: item.product.saleUnit,
              taxable: item.taxable,
              productName: item.product.name
            }))
          }
        }
      })

      await tx.savedCart.deleteMany({ where: { email: customer.email } })

      return created
    })

    const updatedPaymentIntent = await stripe.paymentIntents.update(paymentIntentId, {
      amount: checkout.totalCents,
      description: `Grocery order ${order.id}`,
      metadata: {
        checkoutStatus: "order_submitted",
        orderId: order.id
      },
      receipt_email: checkoutInput.customerEmail
    })

    return NextResponse.json({
      clientSecret: updatedPaymentIntent.client_secret,
      orderId: order.id,
      token: order.accessToken
    })
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[checkout order]", error)
    }
    logError("Checkout order creation failed.", error)
    if (isDatabaseError(error)) {
      return NextResponse.json({ error: "Database error. Please try again." }, { status: 500 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed." },
      { status: 400 }
    )
  }
}
