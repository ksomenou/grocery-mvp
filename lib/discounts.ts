import type { DiscountCode, DiscountCodeType } from "@prisma/client"

import { formatMoney } from "@/lib/format"

export function normalizeDiscountCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "")
}

export function discountCodeLabel(discount: Pick<DiscountCode, "amountOffCents" | "percentOff" | "type">) {
  if (discount.type === "PERCENT") {
    return `${discount.percentOff ?? 0}% off`
  }

  return `${formatMoney(discount.amountOffCents ?? 0)} off`
}

export function calculateDiscountCodeAmount({
  subtotalCents,
  type,
  percentOff,
  amountOffCents
}: {
  amountOffCents?: number | null
  percentOff?: number | null
  subtotalCents: number
  type: DiscountCodeType
}) {
  const amount = type === "PERCENT"
    ? Math.round(subtotalCents * ((percentOff ?? 0) / 100))
    : amountOffCents ?? 0

  return Math.max(0, Math.min(subtotalCents, amount))
}

export function discountIsUsable(discount: DiscountCode, subtotalCents: number, now = new Date()) {
  if (!discount.isActive) {
    return "Discount code is inactive."
  }

  if (discount.startsAt && discount.startsAt > now) {
    return "Discount code is not active yet."
  }

  if (discount.endsAt && discount.endsAt < now) {
    return "Discount code has expired."
  }

  if (discount.maxRedemptions !== null && discount.redemptionCount >= discount.maxRedemptions) {
    return "Discount code has reached its redemption limit."
  }

  if (discount.minimumOrderCents !== null && subtotalCents < discount.minimumOrderCents) {
    return `Minimum order for this discount is ${formatMoney(discount.minimumOrderCents)}.`
  }

  return ""
}
