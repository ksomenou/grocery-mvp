import Link from "next/link"
import type { Metadata } from "next"
import { unstable_cache } from "next/cache"

import { ProductCard } from "@/components/product-card"
import { SearchBox } from "@/components/search-box"
import { defaultCategoryNames } from "@/lib/default-categories"
import { prisma } from "@/lib/prisma"
import { createQueryTimer } from "@/lib/query-timing"
import { storeName } from "@/lib/store"

export const revalidate = 120
export const preferredRegion = "sfo1"

const productPageSize = 24

export const metadata: Metadata = {
  title: "Products",
  description: `Browse ${storeName} groceries, search products, and add fresh items to your cart.`
}

const productCardSelect = {
  id: true,
  name: true,
  slug: true,
  priceCents: true,
  imageUrl: true,
  stock: true,
  saleUnit: true,
  taxable: true,
  discountPercent: true,
  discountType: true,
  discountValue: true,
  category: { select: { name: true } }
} as const

type ProductFilters = {
  category?: string
  max?: string
  page?: string
  q?: string
  sort?: string
  stock?: string
}

function pageHref(params: Record<string, string | undefined>, page: number) {
  const nextParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      nextParams.set(key, value)
    }
  }
  if (page > 1) {
    nextParams.set("page", String(page))
  } else {
    nextParams.delete("page")
  }

  const query = nextParams.toString()
  return query ? `/products?${query}` : "/products"
}

const getProductsPageData = unstable_cache(
  async ({ category, max, page, q, sort, stock }: ProductFilters) => {
    const timer = createQueryTimer("products")
    const query = q?.trim()
    const maxPrice = max ? Number(max) : undefined
    const currentPage = Math.max(1, Number(page) || 1)
    const categories = await timer.run("categories", () =>
      prisma.category.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true }
      })
    )
    const selectedCategory = category
      ? categories.find((item) => {
        const normalizedCategory = category.toLowerCase().trim()
        return item.slug.toLowerCase() === normalizedCategory || item.name.toLowerCase() === normalizedCategory
      })
      : null
    const productWhere = {
      isActive: true,
      ...(selectedCategory ? { categoryId: selectedCategory.id } : {}),
      ...(stock === "in" ? { stock: { gt: 0 } } : {}),
      ...(Number.isFinite(maxPrice) && maxPrice && maxPrice > 0 ? { priceCents: { lte: Math.round(maxPrice * 100) } } : {}),
      ...(query
        ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { description: { contains: query, mode: "insensitive" as const } },
            { category: { name: { contains: query, mode: "insensitive" as const } } }
          ]
        }
        : {})
    }
    const productOrderBy =
      sort === "price-low"
        ? { priceCents: "asc" as const }
        : sort === "price-high"
          ? { priceCents: "desc" as const }
          : sort === "newest"
            ? { createdAt: "desc" as const }
            : sort === "popular"
              ? { updatedAt: "desc" as const }
              : { name: "asc" as const }
    const [products, productCount] = await Promise.all([
      timer.run("products", () =>
        prisma.product.findMany({
          where: productWhere,
          orderBy: productOrderBy,
          select: productCardSelect,
          skip: (currentPage - 1) * productPageSize,
          take: productPageSize
        })
      ),
      timer.run("product count", () => prisma.product.count({ where: productWhere }))
    ])
    timer.flush()

    return { categories, currentPage, productCount, products, selectedCategory }
  },
  ["products-page-v4"],
  { revalidate: 120, tags: ["products", "categories"] }
)

export default async function ProductsPage({
  searchParams
}: {
  searchParams: Promise<{ category?: string; max?: string; page?: string; q?: string; sort?: string; stock?: string }>
}) {
  const { category, max, page, q, sort, stock } = await searchParams
  const query = q?.trim()
  const { categories, currentPage, productCount, products, selectedCategory } = await getProductsPageData({
    category,
    max,
    page,
    q,
    sort,
    stock
  })
  const quickFilters = defaultCategoryNames.slice(0, 10)
  const suggestedSearches = defaultCategoryNames.slice(0, 6)
  const totalPages = Math.max(1, Math.ceil(productCount / productPageSize))
  const pagingParams = { category, max, q, sort, stock }

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
      {productCount > productPageSize ? (
        <nav className="pagination-row" aria-label="Product pagination">
          <Link className={`button secondary${currentPage <= 1 ? " disabled" : ""}`} href={pageHref(pagingParams, currentPage - 1)}>
            Previous
          </Link>
          <span>Page {currentPage} of {totalPages}</span>
          <Link className={`button secondary${currentPage >= totalPages ? " disabled" : ""}`} href={pageHref(pagingParams, currentPage + 1)}>
            Next
          </Link>
        </nav>
      ) : null}
    </main>
  )
}
