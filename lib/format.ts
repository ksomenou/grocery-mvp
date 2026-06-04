export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100)
}

export function formatSaleUnit(saleUnit: "EACH" | "LB") {
  return saleUnit === "LB" ? "lb" : "each"
}

export function formatUnitPrice(cents: number, saleUnit: "EACH" | "LB") {
  return saleUnit === "LB" ? `${formatMoney(cents)}/lb` : `${formatMoney(cents)} each`
}

export type ProductDiscountType = "NONE" | "PERCENT" | "FIXED"

export function discountAmountCents(
  priceCents: number,
  discountType?: ProductDiscountType | null,
  discountValue?: number | null,
  legacyDiscountPercent?: number | null
) {
  if (discountType === "PERCENT" && discountValue && discountValue > 0) {
    return Math.min(priceCents, Math.round(priceCents * (discountValue / 100)))
  }

  if (discountType === "FIXED" && discountValue && discountValue > 0) {
    return Math.min(priceCents, discountValue)
  }

  if (legacyDiscountPercent && legacyDiscountPercent > 0) {
    return Math.min(priceCents, Math.round(priceCents * (legacyDiscountPercent / 100)))
  }

  return 0
}

export function discountedPriceCents(
  priceCents: number,
  discountTypeOrLegacyPercent?: ProductDiscountType | number | null,
  discountValue?: number | null,
  legacyDiscountPercent?: number | null
) {
  if (typeof discountTypeOrLegacyPercent === "number") {
    return Math.max(0, priceCents - discountAmountCents(priceCents, null, null, discountTypeOrLegacyPercent))
  }

  return Math.max(0, priceCents - discountAmountCents(priceCents, discountTypeOrLegacyPercent, discountValue, legacyDiscountPercent))
}

export function hasDiscount(
  priceCents: number,
  discountType?: ProductDiscountType | null,
  discountValue?: number | null,
  legacyDiscountPercent?: number | null
) {
  return discountAmountCents(priceCents, discountType, discountValue, legacyDiscountPercent) > 0
}

export function formatDiscountBadge(
  priceCents: number,
  discountType?: ProductDiscountType | null,
  discountValue?: number | null,
  legacyDiscountPercent?: number | null
) {
  if (discountType === "PERCENT" && discountValue && discountValue > 0) {
    return `${discountValue}% off`
  }

  if (discountType === "FIXED" && discountValue && discountValue > 0) {
    return `${formatMoney(Math.min(priceCents, discountValue))} off`
  }

  if (legacyDiscountPercent && legacyDiscountPercent > 0) {
    return `${legacyDiscountPercent}% off`
  }

  return ""
}

export function formatQuantity(quantity: number, saleUnit: "EACH" | "LB") {
  return saleUnit === "LB" ? `${quantity.toFixed(2).replace(/\.?0+$/, "")} lb` : `${quantity}`
}

export function formatLineItem(name: string, quantity: number, priceCents: number, saleUnit: "EACH" | "LB") {
  return `${titleCase(name)} - ${formatQuantity(quantity, saleUnit)} x ${formatUnitPrice(priceCents, saleUnit)}`
}

export function titleCase(value: string) {
  const smallWords = new Set(["and", "or", "the", "of"])

  return value
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      return word
        .split("-")
        .map((part) => {
          const lower = part.toLowerCase()
          if (index > 0 && smallWords.has(lower)) {
            return lower
          }

          return lower.charAt(0).toUpperCase() + lower.slice(1)
        })
        .join("-")
    })
    .join(" ")
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
}

export function deliveryFeeCents() {
  return Number.parseInt(process.env.DELIVERY_FEE_CENTS ?? "599", 10)
}

export function freeDeliveryThresholdCents() {
  return 10000
}

export function deliveryFeeForSubtotal(subtotalCents: number, baseFeeCents = deliveryFeeCents()) {
  return subtotalCents >= freeDeliveryThresholdCents() ? 0 : baseFeeCents
}

export function deliveryEstimateForCart(itemCount: number) {
  if (itemCount >= 8) {
    return "60-75 min"
  }

  if (itemCount >= 4) {
    return "50-65 min"
  }

  return "45-60 min"
}
