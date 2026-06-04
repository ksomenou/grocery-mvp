"use client"

import { useEffect, useState } from "react"

import { ProductCard } from "@/components/product-card"

type ViewedProduct = {
  id: string
  name: string
  slug: string
  priceCents: number
  originalPriceCents?: number
  discountBadge?: string
  discountPercent?: number | null
  discountType?: "NONE" | "PERCENT" | "FIXED" | null
  discountValue?: number | null
  imageUrl: string
  stock: number
  saleUnit: "EACH" | "LB"
  category: { name: string }
}

const storageKey = "freshcart-recently-viewed"

export function RecentlyViewedProducts({ current }: { current: ViewedProduct }) {
  const [products, setProducts] = useState<ViewedProduct[]>([])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let existing: ViewedProduct[] = []

      try {
        const value = window.localStorage.getItem(storageKey)
        existing = value ? JSON.parse(value) : []
        if (!Array.isArray(existing)) {
          existing = []
        }
      } catch {
        existing = []
      }

      setProducts(existing.filter((product) => product.id !== current.id).slice(0, 4))

      const next = [current, ...existing.filter((product) => product.id !== current.id)].slice(0, 8)
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // Recent views are optional; ignore blocked storage.
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [current])

  if (products.length === 0) {
    return null
  }

  return (
    <section className="section related-products">
      <div className="section-head">
        <div>
          <h2>Recently viewed</h2>
          <p>Pick up where you left off.</p>
        </div>
      </div>
      <div className="related-product-rail grid product-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}
