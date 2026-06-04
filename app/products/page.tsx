import Link from "next/link"
import type { Metadata } from "next"

import { ProductCard } from "@/components/product-card"
import { SearchBox } from "@/components/search-box"
import { defaultCategoryNames } from "@/lib/default-categories"
import { prisma } from "@/lib/prisma"
import { storeName } from "@/lib/store"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Products",
  description: `Browse ${storeName} groceries, search products, and add fresh items to your cart.`
}

export default async function ProductsPage({
  searchParams
}: {
  searchParams: Promise<{ category?: string; max?: string; q?: string; sort?: string; stock?: string }>
}) {
  const { category, max, q, sort, stock } = await searchParams
  const query = q?.trim()
  const maxPrice = max ? Number(max) : undefined
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } })
  const selectedCategory = category
    ? categories.find((item) => {
      const normalizedCategory = category.toLowerCase().trim()
      return item.slug.toLowerCase() === normalizedCategory || item.name.toLowerCase() === normalizedCategory
    })
    : null
  const quickFilters = defaultCategoryNames.slice(0, 10)
  const suggestedSearches = defaultCategoryNames.slice(0, 6)
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(selectedCategory ? { categoryId: selectedCategory.id } : {}),
      ...(stock === "in" ? { stock: { gt: 0 } } : {}),
      ...(Number.isFinite(maxPrice) && maxPrice && maxPrice > 0 ? { priceCents: { lte: Math.round(maxPrice * 100) } } : {}),
      ...(query
        ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
            { category: { name: { contains: query, mode: "insensitive" } } }
          ]
        }
        : {})
    },
    include: { category: true },
    orderBy:
      sort === "price-low"
        ? { priceCents: "asc" }
        : sort === "price-high"
          ? { priceCents: "desc" }
          : sort === "newest"
            ? { createdAt: "desc" }
            : sort === "popular"
              ? { updatedAt: "desc" }
              : { name: "asc" }
  })

  return (
    <main className={`shell products-page${selectedCategory ? " has-category-filter" : ""}`}>
      <div className="page-title">
        <h1>Groceries</h1>
        <p>Search fresh items, compare stock, and build a local delivery order.</p>
        <SearchBox />
        <div className="mobile-product-toolbar">
          {selectedCategory ? (
            <span className="active-filter-chip">Category: {selectedCategory.name}</span>
          ) : null}
          {(selectedCategory || max || stock || sort) ? (
            <Link className="clear-filter-link" href={query ? `/products?q=${encodeURIComponent(query)}` : "/products"}>
              Clear filter
            </Link>
          ) : null}
        </div>
        <input className="filter-toggle-input" id="product-filter-toggle" type="checkbox" />
        <label className="button secondary product-filter-toggle" htmlFor="product-filter-toggle">
          Filter
        </label>
        <div className="product-filter-panel">
          <form className="product-filters" action="/products">
            {query ? <input name="q" type="hidden" value={query} /> : null}
            <label>
              <span>Category</span>
              <select className="select" name="category" defaultValue={selectedCategory?.slug ?? ""}>
                <option value="">All categories</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.slug}>{item.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Max price</span>
              <select className="select" name="max" defaultValue={max ?? ""}>
                <option value="">Any price</option>
                <option value="5">Under $5</option>
                <option value="10">Under $10</option>
                <option value="25">Under $25</option>
                <option value="50">Under $50</option>
              </select>
            </label>
            <label className="filter-check">
              <input defaultChecked={stock === "in"} name="stock" type="checkbox" value="in" />
              In stock
            </label>
            <label>
              <span>Sort</span>
              <select className="select" name="sort" defaultValue={sort ?? "popular"}>
                <option value="popular">Popular</option>
                <option value="price-low">Price low/high</option>
                <option value="price-high">Price high/low</option>
                <option value="newest">Newest</option>
              </select>
            </label>
            <button className="button secondary" type="submit">Apply</button>
          </form>
        </div>
        <div className="discovery-chips" aria-label="Category quick filters">
          {quickFilters.map((category) => (
            <Link className="discovery-chip" href={`/products?q=${encodeURIComponent(category)}`} key={category}>
              {category}
            </Link>
          ))}
        </div>
      </div>
      <div className="grid product-grid section">
        {products.length > 0 ? (
          products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))
        ) : (
          <div className="empty-state product-empty-state">
            <h3>{query ? "No matching groceries found" : "No products yet"}</h3>
            <p>{query ? `Try a suggested search or browse all ${storeName} groceries.` : "Products will appear here once they are added in admin."}</p>
            {query ? (
              <>
                <div className="popular-searches" aria-label="Suggested searches">
                  <span>Suggested searches</span>
                  {suggestedSearches.map((term) => (
                    <Link className="discovery-chip" href={`/products?q=${encodeURIComponent(term)}`} key={term}>
                      {term}
                    </Link>
                  ))}
                </div>
                <Link className="button secondary" href="/products">Clear search</Link>
              </>
            ) : null}
          </div>
        )}
      </div>
    </main>
  )
}
