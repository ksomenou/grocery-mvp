import { NextResponse } from "next/server"
import { z } from "zod"

import { calculateDiscountCodeAmount, discountIsUsable, normalizeDiscountCode } from "@/lib/discounts"
import { discountedPriceCents, formatMoney } from "@/lib/format"
import { prisma } from "@/lib/prisma"

const validateDiscountSchema = z.object({
  code: z.string().min(1),
  items: z.array(z.object({ id: z.string(), quantity: z.number().finite().positive() })).min(1)
})

export async function POST(request: Request) {
  const parsed = validateDiscountSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a discount code and cart items." }, { status: 400 })
  }

  try {
    const code = normalizeDiscountCode(parsed.data.code)
    const itemTotals = new Map<string, number>()
    for (const item of parsed.data.items) {
      itemTotals.set(item.id, (itemTotals.get(item.id) ?? 0) + item.quantity)
    }

    const products = await prisma.product.findMany({
      where: { id: { in: Array.from(itemTotals.keys()) }, isActive: true }
    })
    const lineItems = products.map((product) => {
      const quantity = itemTotals.get(product.id) ?? 0
      return {
        product,
        quantity,
        priceCents: discountedPriceCents(product.priceCents, product.discountType, product.discountValue, product.discountPercent)
      }
    })
    const subtotalCents = Math.round(lineItems.reduce((sum, item) => sum + item.priceCents * item.quantity, 0))
    const discount = await prisma.discountCode.findUnique({
      where: { code },
      include: { product: true }
    })
    if (!discount) {
      throw new Error("Discount code was not found.")
    }

    const discountError = discountIsUsable(discount, subtotalCents)
    if (discountError) {
      throw new Error(discountError)
    }

    const baseCents = discount.scope === "PRODUCT"
      ? Math.round(lineItems
          .filter((item) => item.product.id === discount.productId)
          .reduce((sum, item) => sum + item.priceCents * item.quantity, 0))
      : subtotalCents

    if (discount.scope === "PRODUCT" && baseCents <= 0) {
      throw new Error("Code valid only for specific products.")
    }

    const discountCents = calculateDiscountCodeAmount({
      subtotalCents: baseCents,
      type: discount.type,
      percentOff: discount.percentOff,
      amountOffCents: discount.amountOffCents
    })

    return NextResponse.json({
      discountCents,
      message: discount.scope === "PRODUCT" && discount.product
        ? `Discount applied to ${discount.product.name}.`
        : `Discount applied: ${formatMoney(discountCents)} off.`
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Discount code could not be applied." },
      { status: 400 }
    )
  }
}
