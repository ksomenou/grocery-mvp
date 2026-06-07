import { Prisma } from "@prisma/client"
import { z } from "zod"

import { calculateDiscountCodeAmount, discountIsUsable, normalizeDiscountCode } from "@/lib/discounts"
import { calculateTaxCents, deliveryFeeForSubtotal, discountedPriceCents } from "@/lib/format"
import { prisma } from "@/lib/prisma"
import { isValidScheduleWindow, parseScheduleDate } from "@/lib/scheduling"

export const checkoutSchema = z.object({
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

export type CheckoutInput = z.infer<typeof checkoutSchema>

export function checkoutValidationMessage(error: z.ZodError) {
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

export function isDatabaseError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientUnknownRequestError
}

export function assertStripeConfigured() {
  const key = process.env.STRIPE_SECRET_KEY

  if (!key || key.includes("replace_me") || !key.startsWith("sk_")) {
    throw new Error("Stripe payment keys are not configured.")
  }
}

export async function calculateCheckout(data: CheckoutInput) {
  if (data.fulfillmentMethod === "DELIVERY" && !data.deliveryAddress?.trim()) {
    throw new Error("Delivery address is required for delivery orders.")
  }

  const customerPhone = data.customerPhone?.trim() || null
  const phoneDigits = customerPhone?.replace(/\D/g, "") ?? ""
  if (data.fulfillmentMethod === "DELIVERY" && phoneDigits.length < 7) {
    throw new Error("Enter a phone number for delivery updates.")
  }

  const scheduledDate = parseScheduleDate(data.scheduledDate)
  const scheduledWindow = data.scheduledWindow?.trim() || ""
  if (!scheduledDate || !scheduledWindow) {
    throw new Error("Choose a delivery or pickup schedule.")
  }

  if (!isValidScheduleWindow(scheduledDate, scheduledWindow)) {
    throw new Error("Choose an available schedule window for that date.")
  }

  const itemTotals = new Map<string, number>()
  for (const item of data.items) {
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
      priceCents: discountedPriceCents(product.priceCents, product.discountType, product.discountValue, product.discountPercent),
      taxable: product.taxable
    }
  })

  const subtotalCents = Math.round(orderItems.reduce((sum, item) => sum + item.priceCents * item.quantity, 0))
  const taxableSubtotalCents = Math.round(
    orderItems
      .filter((item) => item.taxable)
      .reduce((sum, item) => sum + item.priceCents * item.quantity, 0)
  )
  const discountCode = data.discountCode ? normalizeDiscountCode(data.discountCode) : ""
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
  const taxableDiscountCents = discount?.scope === "PRODUCT"
    ? orderItems.some((item) => item.taxable && item.product.id === discount.productId) ? discountCents : 0
    : subtotalCents > 0 ? Math.round(discountCents * (taxableSubtotalCents / subtotalCents)) : 0
  const taxableBaseCents = Math.max(0, taxableSubtotalCents - taxableDiscountCents)
  const taxCents = calculateTaxCents(taxableBaseCents)
  const feeCents = data.fulfillmentMethod === "DELIVERY" ? deliveryFeeForSubtotal(subtotalCents) : 0
  const totalCents = discountedSubtotalCents + taxCents + feeCents

  return {
    customerPhone,
    deliveryWindow: scheduledWindow,
    discount,
    discountCents,
    feeCents,
    orderItems,
    scheduledDate,
    scheduledWindow,
    subtotalCents,
    taxCents,
    totalCents
  }
}
