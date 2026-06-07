import Link from "next/link"
import Image from "next/image"
import { unstable_cache } from "next/cache"

import { CategoryCarousel } from "@/components/category-carousel"
import { HomeHeroCarousel } from "@/components/home-hero-carousel"
import { ProductCard } from "@/components/product-card"
import { todaysBusinessHours } from "@/lib/business-hours"
import { defaultCategoryNames } from "@/lib/default-categories"
import { deliveryStatusForDate } from "@/lib/delivery-status"
import { prisma } from "@/lib/prisma"
import { storeName } from "@/lib/store"

export const revalidate = 300

const categoryChips = defaultCategoryNames

const homepageProductSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  priceCents: true,
  imageUrl: true,
  stock: true,
  saleUnit: true,
  taxable: true,
  discountPercent: true,
  discountType: true,
  discountValue: true,
  featuredHome: true,
  featuredBanner: true,
  featuredFresh: true,
  featuredPopular: true,
  category: {
    select: {
      name: true,
      slug: true
    }
  }
} as const

const categoryIcons: Record<string, string> = {
  Fruits: "\uD83C\uDF4E",
  Vegetables: "\uD83E\uDD66",
  "Sweet Potatoes & Yams": "\uD83C\uDF60",
  Meat: "\uD83E\uDD69",
  Seafood: "\uD83D\uDC1F",
  Frozen: "\u2744\uFE0F",
  "Rice/Pasta/Beans": "\uD83C\uDF5A",
  Bakery: "\uD83E\uDD56",
  Breakfast: "\uD83E\uDD63",
  Snacks: "\uD83C\uDF6A",
  Drinks: "\uD83E\uDD64",
  "Health & Beauty": "\u2728",
  "African Foods": "\uD83C\uDF0D",
  "Caribbean Foods": "\uD83C\uDF34"
}

function normalizeCategory(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function shelfClassName(count: number) {
  return `grid product-grid product-shelf shelf-count-${Math.min(count, 4)}`
}

const featuredShelves = [
  { title: "Fresh produce", subtitle: "Crisp fruits, vegetables, yams, and market picks.", terms: ["Fruits", "Vegetables", "Sweet Potatoes & Yams"], fallbackQuery: "produce" },
  { title: "Caribbean/African essentials", subtitle: "Island staples, African favorites, pantry picks, and comfort foods.", terms: ["Caribbean Foods", "African Foods"], fallbackQuery: "Caribbean African Foods" }
]

const getHomepageData = unstable_cache(
  async () => {
    const [categories, activeProductCount, products] = await Promise.all([
      prisma.category.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true }
      }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.findMany({
        where: { isActive: true },
        orderBy: [{ featuredBanner: "desc" }, { featuredPopular: "desc" }, { featuredFresh: "desc" }, { featuredHome: "desc" }, { updatedAt: "desc" }],
        select: homepageProductSelect,
        take: 36
      })
    ])

    return { activeProductCount, categories, products }
  },
  ["homepage-products-v2"],
  { revalidate: 300, tags: ["homepage"] }
)

export default async function HomePage() {
  const deliveryStatus = deliveryStatusForDate()
  const { categories, activeProductCount, products } = await getHomepageData()
  const fallbackProducts = products.slice(0, 8)
  const bannerProducts = products.filter((product) => product.featuredBanner).slice(0, 4)
  const freshFeatured = products.filter((product) => product.stock > 0 && product.featuredFresh).slice(0, 8)
  const popularFeatured = products.filter((product) => product.featuredPopular).slice(0, 8)
  const homeFeatured = products.filter((product) => product.featuredHome).slice(0, 8)
  const weeklyDeals = [...products].filter((product) => product.stock > 0).sort((a, b) => a.priceCents - b.priceCents).slice(0, 8)
  const popularNearYou = popularFeatured.length > 0 ? popularFeatured : fallbackProducts
  const freshToday = freshFeatured.length > 0 ? freshFeatured : fallbackProducts.filter((product) => product.stock > 0)
  const recommended = homeFeatured.length > 0 ? homeFeatured : fallbackProducts
  const heroProducts = (bannerProducts.length > 0 ? bannerProducts : fallbackProducts).map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    imageUrl: product.imageUrl,
    priceCents: product.priceCents,
    discountPercent: product.discountPercent,
    discountType: product.discountType,
    discountValue: product.discountValue,
    saleUnit: product.saleUnit,
    category: {
      name: product.category.name,
      slug: product.category.slug
    }
  }))
  const departmentItems = categoryChips.map((name) => {
    const category = categories.find((item) => normalizeCategory(item.name).includes(normalizeCategory(name)))
    return {
      href: category ? `/category/${category.slug}` : `/products?q=${encodeURIComponent(name)}`,
      icon: categoryIcons[name],
      name
    }
  })
  const freshPromoImage =
    [...freshToday, ...fallbackProducts].find((product) => {
      const haystack = normalizeCategory(`${product.name} ${product.category.name}`)
      return product.imageUrl !== "/images/placeholder.svg" && /fruit|produce|vegetable|yam|potato|banana|avocado/.test(haystack)
    })?.imageUrl ?? "/uploads/1779808012256-screenshot-2026-05-26-104430.png"
  const pantryPromoImage =
    [...weeklyDeals, ...recommended, ...fallbackProducts].find((product) => {
      const haystack = normalizeCategory(`${product.name} ${product.category.name}`)
      return product.imageUrl !== "/images/placeholder.svg" && /pantry|rice|bean|drink|snack|cereal|water|pasta/.test(haystack)
    })?.imageUrl ?? "/uploads/1779807733805-screenshot-2026-05-26-105942.png"
  const shelfSections = featuredShelves.map((shelf) => {
    const normalizedTerms = shelf.terms.map(normalizeCategory)
    const category = categories.find((item) =>
      normalizedTerms.some((term) => normalizeCategory(item.name).includes(term) || term.includes(normalizeCategory(item.name)))
    )
    const shelfItems = products
      .filter((product) =>
        normalizedTerms.some((term) => {
          const categoryName = normalizeCategory(product.category.name)
          return categoryName.includes(term) || term.includes(categoryName)
        })
      )
      .slice(0, 6)

    return {
      ...shelf,
      href: category ? `/category/${category.slug}` : `/products?q=${encodeURIComponent(shelf.fallbackQuery)}`,
      products: shelfItems
    }
  }).filter((shelf) => shelf.products.length > 0)

  return (
    <main className="home">
      <section className="shell storefront-intro-hero">
        <div className="storefront-intro-copy">
          <span className="hero-eyebrow">Fresh African &amp; Caribbean products</span>
          <h1>International groceries delivered to your doorstep</h1>
          <div className="storefront-hero-badges" aria-label="Fulfillment options">
            <span>Local delivery available</span>
            <span>Pickup available</span>
          </div>
          <div className="storefront-hours-card" aria-label="Business hours">
            <span>Open today</span>
            <strong>{todaysBusinessHours()}</strong>
            <p>Monday-Saturday 10:00 AM – 9:00 PM · Sunday 12:00 PM – 9:00 PM</p>
          </div>
          <div className="storefront-hero-actions">
            <Link className="button" href="/products">Shop now</Link>
            <Link className="button secondary" href="#shop-categories">Browse categories</Link>
          </div>
          <div className="storefront-market-visual" aria-hidden="true">
            <div className="market-card large">
              <div className="market-card-image relative">
                <Image alt="" fill priority sizes="180px" src={freshPromoImage} />
              </div>
            </div>
            <div className="market-card small top">
              <div className="market-card-image relative">
                <Image alt="" fill sizes="110px" src={pantryPromoImage} />
              </div>
            </div>
            <div className="market-card small bottom">
              <div className="market-card-image relative">
                <Image alt="" fill sizes="110px" src={heroProducts[0]?.imageUrl ?? freshPromoImage} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="category-bar-wrap" id="shop-categories" aria-label="Shop categories">
        <div className="shell">
          <CategoryCarousel
            items={departmentItems}
          />
        </div>
      </section>

      <section className="shell retail-hero">
        <HomeHeroCarousel activeProductCount={activeProductCount} products={heroProducts} />
      </section>

      <section className="shell promo-strip" aria-label="Promotions">
        <Link className="promo-card green" href="/products?q=produce">
          <div>
            <span>Fresh today</span>
            <strong>Save on produce</strong>
            <p>Hand-picked fruits and vegetables.</p>
          </div>
          <div className="promo-image relative" aria-hidden="true">
            <Image alt="" fill sizes="120px" src={freshPromoImage} />
          </div>
        </Link>
        <Link className="promo-card yellow" href="/products?q=snacks">
          <div>
            <span>Pantry favorites</span>
            <strong>Stock up for the week</strong>
            <p>Rice, pasta, beans, drinks, and snacks.</p>
          </div>
          <div className="promo-image relative" aria-hidden="true">
            <Image alt="" fill sizes="120px" src={pantryPromoImage} />
          </div>
        </Link>
      </section>

      <section className="shell section department-section">
        <div className="section-head">
          <div>
            <h2>Shop by Department</h2>
            <p>Jump into the aisles {storeName} shoppers use most.</p>
          </div>
        </div>
        <div className="department-grid">
          {departmentItems.map((item) => (
            <Link className="department-tile" href={item.href} key={item.name}>
              <span>{item.icon}</span>
              <strong>{item.name}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="shell section home-section">
        <div className="section-head">
          <div>
            <h2>Popular this week</h2>
            <p>Top picks available nearby with fast delivery.</p>
          </div>
          <Link className="button secondary" href="/products">View all</Link>
        </div>
        <div className={shelfClassName(popularNearYou.length)}>
          {popularNearYou.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {shelfSections.map((shelf) => (
        <section className="shell section home-section" key={shelf.title}>
          <div className="section-head">
            <div>
              <h2>{shelf.title}</h2>
              <p>{shelf.subtitle}</p>
            </div>
            <Link className="button secondary" href={shelf.href}>View all</Link>
          </div>
          <div className={shelfClassName(shelf.products.length)}>
            {shelf.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ))}

      <section className="shell section home-section">
        <div className="section-head">
          <div>
            <h2>Deals</h2>
            <p>Lower-priced finds for the week.</p>
          </div>
        </div>
        <div className={shelfClassName(weeklyDeals.length)}>
          {weeklyDeals.map((product) => (
            <ProductCard badge="Deal" key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="shell closing-promo-section">
        <div className="closing-promo-card">
          <div>
            <span>Delivery available · Pickup available</span>
            <h2>Fresh international groceries for your home</h2>
            <p>Shop African, Caribbean, and everyday grocery essentials with local delivery and pickup.</p>
            <div className="closing-promo-actions">
              <Link className="button" href="/products">Shop products</Link>
              <Link className="button secondary" href="/cart">View cart</Link>
            </div>
          </div>
          <div className="closing-promo-image relative" aria-hidden="true">
            <Image alt="" fill sizes="(min-width: 720px) 220px, 120px" src={pantryPromoImage} />
          </div>
        </div>
      </section>
    </main>
  )
}
