export type CartItem = {
  id: string
  name: string
  slug: string
  priceCents: number
  originalPriceCents?: number
  discountBadge?: string
  imageUrl: string
  stock: number
  saleUnit: "EACH" | "LB"
  quantity: number
}

const cartKey = "freshcart-cart"
let memoryCart: CartItem[] = []

function normalizeCart(items: CartItem[]) {
  return items
    .map((item) => {
      const saleUnit: CartItem["saleUnit"] = item.saleUnit === "LB" ? "LB" : "EACH"
      const rawQuantity = Number(item.quantity)
      const normalizedQuantity =
        saleUnit === "LB" ? Math.round(rawQuantity * 2) / 2 : Math.round(rawQuantity)
      const stock = Number(item.stock)
      const quantity =
        Number.isFinite(normalizedQuantity) && Number.isFinite(stock)
          ? Math.max(0, Math.min(normalizedQuantity, Math.max(0, stock)))
          : 0

      return {
        ...item,
        saleUnit,
        stock: Number.isFinite(stock) ? Math.max(0, stock) : 0,
        quantity
      }
    })
    .filter((item) => item.id && item.quantity > 0)
}

export function readCart(): CartItem[] {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const value = window.localStorage?.getItem(cartKey)
    if (!value) {
      return normalizeCart(memoryCart)
    }

    const items = JSON.parse(value) as CartItem[]
    if (!Array.isArray(items)) {
      return normalizeCart(memoryCart)
    }

    memoryCart = normalizeCart(items)
    return memoryCart
  } catch {
    return normalizeCart(memoryCart)
  }
}

export function writeCart(items: CartItem[]) {
  memoryCart = normalizeCart(items)
  try {
    window.localStorage?.setItem(cartKey, JSON.stringify(memoryCart))
  } catch {
    // Keep the in-memory cart active when browser storage is blocked.
  }
  window.dispatchEvent(new Event("cart-changed"))
}

export function notifyCart(message: string) {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(new CustomEvent("freshcart-toast", { detail: { message } }))
}

export function clearCart() {
  writeCart([])
}
