import Link from "next/link"
import Image from "next/image"

import { AddToCartButton } from "@/components/add-to-cart"
import { deliveryStatusForDate } from "@/lib/delivery-status"
import { discountedPriceCents, formatDiscountBadge, formatQuantity, formatUnitPrice, hasDiscount, titleCase } from "@/lib/format"

type ProductCardProps = {
  product: {
    id: string
    name: string
    slug: string
    priceCents: number
    imageUrl: string
    stock: number
    saleUnit: "EACH" | "LB"
    discountPercent?: number | null
    discountType?: "NONE" | "PERCENT" | "FIXED" | null
    discountValue?: number | null
    category: { name: string }
  }
  badge?: string
}

export function ProductCard({ badge, product }: ProductCardProps) {
  const isOut = product.stock <= 0
  const isLow = product.stock > 0 && product.stock < 5
  const isDiscounted = hasDiscount(product.priceCents, product.discountType, product.discountValue, product.discountPercent)
  const effectivePriceCents = discountedPriceCents(product.priceCents, product.discountType, product.discountValue, product.discountPercent)
  const discountBadge = formatDiscountBadge(product.priceCents, product.discountType, product.discountValue, product.discountPercent)
  const rating = 4 + (product.name.length % 10) / 10
  const deliveryStatus = deliveryStatusForDate()
  const cartProduct = {
    id: product.id,
    imageUrl: product.imageUrl,
    name: product.name,
    originalPriceCents: product.priceCents,
    priceCents: effectivePriceCents,
    discountBadge,
    saleUnit: product.saleUnit,
    slug: product.slug,
    stock: product.stock
  }

  return (
    <article className="card product-card">
      <Link className="product-media relative" href={`/products/${product.slug}`}>
        <Image
          alt={product.name}
          fill
          sizes="(min-width: 1040px) 25vw, (min-width: 720px) 50vw, 100vw"
          src={product.imageUrl}
        />
        {isOut ? <span className="product-badge danger">Out of stock</span> : null}
        {isLow ? <span className="product-badge warning">Low stock</span> : null}
        {isDiscounted ? <span className="product-badge deal">{discountBadge}</span> : null}
        {!isDiscounted && badge ? <span className="product-badge deal">{badge}</span> : null}
      </Link>
      <div className="product-body">
        <div>
          <p className="muted" style={{ fontSize: "0.82rem", margin: "0 0 4px" }}>
            {titleCase(product.category.name)}
          </p>
          <h3>
            <Link href={`/products/${product.slug}`}>{titleCase(product.name)}</Link>
          </h3>
          <div className="product-card-meta">
            <span className="rating-stars" aria-label={`${rating.toFixed(1)} star rating`}>{"★★★★★"}</span>
            <span>{rating.toFixed(1)}</span>
            <span>{deliveryStatus.deliveryLabel}</span>
            <span>{deliveryStatus.pickupLabel}</span>
            <span>In stock nearby</span>
          </div>
        </div>
        <div className="price-row">
          <span className="price-stack">
            {isDiscounted ? <span className="original-price">{formatUnitPrice(product.priceCents, product.saleUnit)}</span> : null}
            <span className="price">{formatUnitPrice(effectivePriceCents, product.saleUnit)}</span>
          </span>
          <span className="stock">{formatQuantity(product.stock, product.saleUnit)} left</span>
        </div>
        <AddToCartButton product={cartProduct} />
      </div>
    </article>
  )
}
