import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"

import { ProductCard } from "@/components/product-card"
import { ProductDetailCartControl } from "@/components/product-detail-cart-control"
import { RecentlyViewedProducts } from "@/components/recently-viewed-products"
import { discountedPriceCents, formatDiscountBadge, formatQuantity, formatUnitPrice, hasDiscount, titleCase } from "@/lib/format"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function customerFriendlyDescription(product: { category: { name: string }; description: string; name: string }) {
  const name = product.name.toLowerCase()
  const category = titleCase(product.category.name)

  if (name.includes("cassava")) {
    return "Fresh cassava root, great for fufu, gari, tapioca, and traditional African dishes. Available for local delivery or pickup."
  }

  if (name.includes("yam")) {
    return "Fresh yams selected for hearty family meals, soups, stews, and traditional African and Caribbean cooking. Available for local delivery or pickup."
  }

  if (name.includes("goat")) {
    return "Quality goat meat for stews, pepper soup, grilling, and traditional home cooking. Available for local delivery or pickup."
  }

  const description = product.description.trim()
  if (description && !description.toLowerCase().includes("pick ready for delivery or pickup today")) {
    return description
  }

  return `Fresh ${titleCase(product.name)} from our ${category} selection, ready for local delivery or pickup.`
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  if (!slug) {
    notFound()
  }

  const product = await prisma.product.findUnique({
    where: { slug },
    include: { category: true }
  })

  if (!product || !product.isActive) {
    notFound()
  }

  const relatedProducts = await prisma.product.findMany({
    where: {
      categoryId: product.categoryId,
      id: { not: product.id },
      isActive: true
    },
    include: { category: true },
    orderBy: { name: "asc" },
    take: 4
  })

  const isDiscounted = hasDiscount(product.priceCents, product.discountType, product.discountValue, product.discountPercent)
  const effectivePriceCents = discountedPriceCents(product.priceCents, product.discountType, product.discountValue, product.discountPercent)
  const discountBadge = formatDiscountBadge(product.priceCents, product.discountType, product.discountValue, product.discountPercent)
  const productDescription = customerFriendlyDescription(product)
  const cartProduct = {
    id: product.id,
    imageUrl: product.imageUrl,
    name: product.name,
    originalPriceCents: product.priceCents,
    priceCents: discountedPriceCents(product.priceCents, product.discountType, product.discountValue, product.discountPercent),
    discountBadge,
    saleUnit: product.saleUnit,
    slug: product.slug,
    stock: product.stock,
    taxable: product.taxable
  }
  const viewedProduct = {
    ...cartProduct,
    discountPercent: product.discountPercent,
    discountType: product.discountType,
    discountValue: product.discountValue,
    category: { name: product.category.name }
  }

  return (
    <main className="shell section">
      <div className="product-detail">
        <div className="detail-image">
          <Image
            alt={product.name}
            height={700}
            priority
            sizes="(min-width: 720px) 60vw, 100vw"
            src={product.imageUrl}
            width={900}
          />
        </div>
        <section className="panel product-detail-info">
          <p className="detail-kicker">{titleCase(product.category.name)}</p>
          <h1>{titleCase(product.name)}</h1>
          <div className="price-row">
            <span className="price-stack">
              {isDiscounted ? <span className="original-price">{formatUnitPrice(product.priceCents, product.saleUnit)}</span> : null}
              <span className="price">{formatUnitPrice(effectivePriceCents, product.saleUnit)}</span>
            </span>
            <span className={`stock-warning ${product.stock <= 0 ? "empty" : ""}`}>
              {product.stock <= 0 ? "Sold out" : `${formatQuantity(product.stock, product.saleUnit)} in stock`}
            </span>
          </div>
          {isDiscounted ? <p className="discount-note">{discountBadge} today</p> : null}
          {product.stock > 0 && product.stock < 5 ? <p className="form-note warning">Low stock: {formatQuantity(product.stock, product.saleUnit)} left</p> : null}
          <p className="detail-delivery">Delivery in 45-60 min • Pickup available</p>
          <div className="detail-actions">
            <ProductDetailCartControl product={cartProduct} />
          </div>
          <div>
            <h2>Description</h2>
            <div className="detail-description-card">
              <p className="detail-description">{productDescription}</p>
            </div>
          </div>
        </section>
      </div>
      {relatedProducts.length > 0 ? (
        <section className="section related-products">
          <div className="section-head">
            <div>
              <h2>Frequently bought together</h2>
              <p>Popular add-ons shoppers pair with this item.</p>
            </div>
          </div>
          <div className="related-product-rail grid product-grid">
            {relatedProducts.slice(0, 3).map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} />
            ))}
          </div>
        </section>
      ) : null}
      {relatedProducts.length > 0 ? (
        <section className="section related-products">
          <div className="section-head">
            <div>
              <h2>You may also like</h2>
              <p>Popular picks from this category.</p>
            </div>
            <Link className="button secondary" href={`/category/${product.category.slug}`}>View more from this category</Link>
          </div>
          <div className="related-product-rail grid product-grid">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} />
            ))}
          </div>
        </section>
      ) : null}
      <RecentlyViewedProducts current={viewedProduct} />
    </main>
  )
}
