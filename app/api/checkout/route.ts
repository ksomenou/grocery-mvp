import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"

import { deliveryFeeForSubtotal, discountedPriceCents, formatLineItem } from "@/lib/format"
import { calculateDiscountCodeAmount, discountIsUsable, normalizeDiscountCode } from "@/lib/discounts"
import { getCurrentUser } from "@/lib/auth"
import { logError } from "@/lib/log"
import { createOrderAccessToken } from "@/lib/orders"
import { prisma } from "@/lib/prisma"
import { isValidScheduleWindow, parseScheduleDate } from "@/lib/scheduling"
import { getStripe } from "@/lib/stripe"

const checkoutSchema = z.object({
  customerName: z.string().trim().min(2, "Enter your full name."),
  customerEmail: z.string().trim().email("Enter a valid email address."),
  customerPhone: z.string().trim().max(30, "Phone number is too long.").nullable().optional(),
  fulfillmentMethod: z.enum(["DELIVERY", "PICKUP"]).default("DELIVERY"),
  deliveryAddress: z.string().nullable().optional(),
  deliveryInstructions: z.string().max(500, "Delivery instructions must be 500 characters or fewer.").nullable().optional(),
  scheduledDate: z.string().trim().nullable().optional(),
  scheduledWindow: z.string().trim().nullable().optional(),
  discountCode: z.string().nullable().optional(),
  items: z.array(z.object({
    id: z.string().min(1, "Cart contains an invalid item."),
    quantity: z.number().finite("Cart contains an invalid quantity.").positive("Cart contains an invalid quantity.")
  })).min(1, "Your cart is empty.")
})

function checkoutValidationMessage(error: z.ZodError) {
  const issue = error.issues[0]
  const field = String(issue?.path[0] ?? "")

  if (field === "customerEmail") {
    return "Enter a valid email address."
  }

  if (field === "customerName") {
    return "Enter your full name."
  }

  if (field === "customerPhone") {
    return "Enter a valid phone number."
  }

  if (field === "items") {
    return issue?.code === "too_small" ? "Your cart is empty." : "Cart contains an invalid item."
  }

  if (field === "fulfillmentMethod") {
    return "Choose delivery or pickup."
  }

  if (field === "deliveryInstructions") {
    return "Delivery instructions must be 500 characters or fewer."
  }

  if (field === "scheduledDate" || field === "scheduledWindow") {
    return "Choose a delivery or pickup schedule."
  }

  return issue?.message || "Please check your checkout details."
}

function isDatabaseError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientUnknownRequestError
}

function assertStripeConfigured() {
  const key = process.env.STRIPE_SECRET_KEY

  if (!key || key.includes("replace_me") || !key.startsWith("sk_")) {
    throw new Error("Stripe payment keys are not configured.")
  }
}

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

    if (parsed.data.fulfillmentMethod === "DELIVERY" && !parsed.data.deliveryAddress?.trim()) {
      throw new Error("Delivery address is required for delivery orders.")
    }

    const customerPhone = parsed.data.customerPhone?.trim() || null
    const phoneDigits = customerPhone?.replace(/\D/g, "") ?? ""
    if (parsed.data.fulfillmentMethod === "DELIVERY" && phoneDigits.length < 7) {
      throw new Error("Enter a phone number for delivery updates.")
    }

    const scheduledDate = parseScheduleDate(parsed.data.scheduledDate)
    const scheduledWindow = parsed.data.scheduledWindow?.trim() || ""
    if (!scheduledDate || !scheduledWindow) {
      throw new Error("Choose a delivery or pickup schedule.")
    }

    if (!isValidScheduleWindow(scheduledDate, scheduledWindow)) {
      throw new Error("Choose an available schedule window for that date.")
    }

    const itemTotals = new Map<string, number>()
    for (const item of parsed.data.items) {
      itemTotals.set(item.id, (itemTotals.get(item.id) ?? 0) + item.quantity)
    }

    const ids = Array.from(itemTotals.keys())
    const products = await prisma.product.findMany({ where: { id: { in: ids }, isActive: true } })
    const productMap = new Map(products.map((product) => [product.id, product]))

    const orderItems = Array.from(itemTotals.entries()).map(([id, quantity]) => {
      const product = productMap.get(id)
      if (!product) {
        throw new Error("Cart contains an item that is no longer available.")
      }
      if (product.stock <= 0) {
        throw new Error(`${product.name} is sold out.`)
      }
      if (product.stock < quantity) {
        throw new Error(`${product.name} only has ${product.stock} left.`)
      }
      if (product.saleUnit === "EACH" && !Number.isInteger(quantity)) {
        throw new Error(`${product.name} must be ordered in whole units.`)
      }
      if (product.saleUnit === "LB" && !Number.isInteger(quantity * 2)) {
        throw new Error(`${product.name} must be ordered in 0.5 lb increments.`)
      }
      return {
        product,
        quantity,
        priceCents: discountedPriceCents(product.priceCents, product.discountType, product.discountValue, product.discountPercent)
      }
    })

    const subtotalCents = Math.round(orderItems.reduce((sum, item) => sum + item.priceCents * item.quantity, 0))
    const discountCode = parsed.data.discountCode ? normalizeDiscountCode(parsed.data.discountCode) : ""
    const discount = discountCode
      ? await prisma.discountCode.findUnique({
          where: { code: discountCode },
          include: { product: true }
        })
      : null
    if (discountCode && !discount) {
      throw new Error("Discount code was not found.")
    }

    const discountError = discount ? discountIsUsable(discount, subtotalCents) : ""
    if (discountError) {
      throw new Error(discountError)
    }

    const discountBaseCents = discount?.scope === "PRODUCT"
      ? Math.round(orderItems
          .filter((item) => item.product.id === discount.productId)
          .reduce((sum, item) => sum + item.priceCents * item.quantity, 0))
      : subtotalCents

    if (discount?.scope === "PRODUCT") {
      if (!discount.productId || !discount.product?.isActive) {
        throw new Error("Discount code is not available for checkout.")
      }

      if (discountBaseCents <= 0) {
        throw new Error("Code valid only for specific products.")
      }
    }

    const discountCents = discount
      ? calculateDiscountCodeAmount({
          subtotalCents: discountBaseCents,
          type: discount.type,
          percentOff: discount.percentOff,
          amountOffCents: discount.amountOffCents
        })
      : 0
    const discountedSubtotalCents = Math.max(0, subtotalCents - discountCents)
    const feeCents = parsed.data.fulfillmentMethod === "DELIVERY" ? deliveryFeeForSubtotal(subtotalCents) : 0
    const deliveryWindow = scheduledWindow
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    const currentUser = await getCurrentUser()

    const order = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { email: parsed.data.customerEmail.toLowerCase() },
        update: { name: parsed.data.customerName },
        create: {
          email: parsed.data.customerEmail.toLowerCase(),
          name: parsed.data.customerName
        }
      })

      const created = await tx.order.create({
        data: {
          accessToken: createOrderAccessToken(),
          userId: currentUser?.role === "CUSTOMER" ? currentUser.id : null,
          customerId: customer.id,
          customerName: parsed.data.customerName,
          customerEmail: customer.email,
          customerPhone,
          fulfillmentMethod: parsed.data.fulfillmentMethod,
          deliveryAddress:
            parsed.data.fulfillmentMethod === "DELIVERY"
              ? parsed.data.deliveryAddress?.trim() ?? ""
              : "Pickup at store",
          deliveryInstructions:
            parsed.data.fulfillmentMethod === "DELIVERY"
              ? parsed.data.deliveryInstructions?.trim() || null
              : null,
          deliveryWindow,
          scheduledDate,
          scheduledWindow,
          subtotalCents,
          discountCode: discount?.code ?? null,
          discountCents,
          deliveryFeeCents: feeCents,
          totalCents: discountedSubtotalCents + feeCents,
          items: {
            create: orderItems.map((item) => ({
              productId: item.product.id,
              quantity: item.quantity,
              priceCents: item.priceCents,
              saleUnit: item.product.saleUnit,
              productName: item.product.name
            }))
          }
        }
      })

      await tx.savedCart.deleteMany({ where: { email: customer.email } })

      return created
    })

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: parsed.data.customerEmail,
      metadata: { orderId: order.id },
      line_items: [
        ...orderItems.map((item) => ({
          quantity: item.product.saleUnit === "EACH" ? Math.round(item.quantity) : 1,
          price_data: {
            currency: "usd",
            product_data: {
              name:
                item.product.saleUnit === "EACH"
                  ? item.product.name
                  : formatLineItem(item.product.name, item.quantity, item.priceCents, item.product.saleUnit)
            },
            unit_amount: item.product.saleUnit === "EACH" ? item.priceCents : Math.round(item.priceCents * item.quantity)
          }
        })),
        ...(feeCents > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: "usd",
                  product_data: { name: "Local delivery" },
                  unit_amount: feeCents
                }
              }
            ]
          : [])
      ],
      ...(discountCents > 0
        ? {
            discounts: [
              {
                coupon: (await getStripe().coupons.create({
                  amount_off: discountCents,
                  currency: "usd",
                  duration: "once",
                  name: discount?.code ?? "FreshCart discount"
                })).id
              }
            ]
          }
        : {}),
      success_url: `${appUrl}/order-confirmation?order=${order.id}&token=${order.accessToken}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/cart`
    })

    await prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id }
    })

    return NextResponse.json({ url: session.url })
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
