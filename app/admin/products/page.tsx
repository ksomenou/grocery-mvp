import { unstable_cache } from "next/cache"
import type { Prisma } from "@prisma/client"

import { AdminNav } from "@/components/admin-nav"
import { AdminProductList } from "@/components/admin-product-list"
import { AdminActionForm, ImagePreviewInput, SubmitButton } from "@/components/admin-ui"
import { ProductCategoryField } from "@/components/product-category-field"
import { createProduct } from "@/lib/actions"
import { defaultCategoryNames } from "@/lib/default-categories"
import { prisma } from "@/lib/prisma"
import { createQueryTimer } from "@/lib/query-timing"

export const dynamic = "force-dynamic"
export const preferredRegion = "sfo1"

const adminProductPageSize = 25

const adminProductSelect = {
  id: true,
  name: true,
  description: true,
  priceCents: true,
  discountPercent: true,
  discountType: true,
  discountValue: true,
  imageUrl: true,
  stock: true,
  lowStockThreshold: true,
  saleUnit: true,
  taxable: true,
  featuredHome: true,
  featuredBanner: true,
  featuredFresh: true,
  featuredPopular: true,
  isActive: true,
  category: { select: { name: true } }
} as const

const getAdminProductSummary = unstable_cache(
  async () => {
    const timer = createQueryTimer("admin/products-summary")
    const [pendingOrders, lowStockRows] = await Promise.all([
      timer.run("pending paid orders", () =>
        prisma.order.count({
          where: {
            paymentStatus: "PAID",
            status: { in: ["RECEIVED", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"] }
          }
        })
      ),
      timer.run("low stock count", () =>
        prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS count
          FROM "Product"
          WHERE "isActive" = true
          AND "stock" > 0
          AND "stock" <= "lowStockThreshold"
        `
      )
    ])
    timer.flush()

    return {
      lowStockCount: Number(lowStockRows[0]?.count ?? 0),
      pendingOrders
    }
  },
  ["admin-products-summary-v1"],
  { revalidate: 60, tags: ["admin-products-summary"] }
)

function adminProductsPageHref(page: number, filters: { category: string; q: string; stock: string }) {
  const params = new URLSearchParams()

  if (page > 1) {
    params.set("page", String(page))
  }

  if (filters.q) {
    params.set("q", filters.q)
  }

  if (filters.category) {
    params.set("category", filters.category)
  }

  if (filters.stock !== "all") {
    params.set("stock", filters.stock)
  }

  const query = params.toString()
  return query ? `/admin/products?${query}` : "/admin/products"
}

export default async function AdminProductsPage({
  searchParams
}: {
  searchParams: Promise<{ category?: string; page?: string; q?: string; stock?: string }>
}) {
  const { category, page, q, stock } = await searchParams
  const currentPage = Math.max(1, Number(page) || 1)
  const activeQuery = typeof q === "string" ? q.trim() : ""
  const activeCategory = typeof category === "string" ? category.trim() : ""
  const activeStockFilter = ["active", "hidden", "low", "out"].includes(stock ?? "") ? stock ?? "all" : "all"
  const productWhere: Prisma.ProductWhereInput = {
    AND: [
      activeQuery
        ? {
            OR: [
              { name: { contains: activeQuery, mode: "insensitive" } },
              { category: { name: { contains: activeQuery, mode: "insensitive" } } }
            ]
          }
        : {},
      activeCategory ? { category: { name: activeCategory } } : {},
      activeStockFilter === "active" ? { isActive: true } : {},
      activeStockFilter === "hidden" ? { isActive: false } : {},
      activeStockFilter === "low" ? { isActive: true, stock: { gt: 0, lte: 5 } } : {},
      activeStockFilter === "out" ? { stock: { lte: 0 } } : {}
    ]
  }
  const timer = createQueryTimer("admin/products")
  const [categories, products, summary] = await Promise.all([
    timer.run("categories", () => prisma.category.findMany({ orderBy: { name: "asc" }, select: { name: true } })),
    timer.run("products page", () =>
      prisma.product.findMany({
        orderBy: { createdAt: "desc" },
        select: adminProductSelect,
        where: productWhere,
        skip: (currentPage - 1) * adminProductPageSize,
        take: adminProductPageSize + 1
      })
    ),
    timer.run("cached summary counts", () => getAdminProductSummary())
  ])
  timer.flush()
  const { lowStockCount, pendingOrders } = summary
  const hasNextPage = products.length > adminProductPageSize
  const visibleProducts = products.slice(0, adminProductPageSize)
  const categoryOptions = Array.from(
    new Set([...defaultCategoryNames, ...categories.map((category) => category.name)])
  )

  return (
    <main className="shell">
      <div className="page-title">
        <p className="admin-kicker">Store admin</p>
        <h1>Products</h1>
        <p>Add products, upload images, change prices, and manage inventory stock.</p>
        <AdminNav active="products" lowStockCount={lowStockCount} pendingOrderCount={pendingOrders} />
      </div>

      <div className="admin-shell">
        <section className="panel admin-sticky">
          <AdminActionForm action={createProduct}>
            <h2 style={{ margin: 0 }}>Add product</h2>
            <ImagePreviewInput label="Product image" uploadEndpoint="/api/admin/uploads/product-image" />
            <label className="form-field">
              <span>Product name</span>
              <input className="field" name="name" placeholder="Organic apples" required />
            </label>
            <label className="form-field">
              <span>Description</span>
              <textarea className="textarea" name="description" placeholder="Short product description" required />
            </label>
            <ProductCategoryField categories={categoryOptions} />
            <div className="form-row">
              <label className="form-field">
                <span>Sold by</span>
                <select className="select" defaultValue="EACH" name="saleUnit" required>
                  <option value="EACH">Each</option>
                  <option value="LB">Pound</option>
                </select>
              </label>
              <label className="form-field">
                <span>Price</span>
                <input className="field" min="0" name="price" placeholder="4.99" required step="0.01" type="number" />
              </label>
            </div>
            <div className="form-row">
              <label className="form-field">
                <span>Discount type</span>
                <select className="select" defaultValue="NONE" name="discountType">
                  <option value="NONE">None</option>
                  <option value="PERCENT">Percent</option>
                  <option value="FIXED">Fixed amount</option>
                </select>
              </label>
              <label className="form-field">
                <span>Discount value</span>
                <input className="field" min="0" name="discountValue" placeholder="10 or 2.00" step="0.01" type="number" />
              </label>
            </div>
            <div className="form-row">
              <label className="form-field">
                <span>Stock</span>
                <input className="field" min="0" name="stock" placeholder="24" required step="0.01" type="number" />
              </label>
              <label className="form-field">
                <span>Low stock threshold</span>
                <input className="field" defaultValue="5" min="0" name="lowStockThreshold" required step="0.01" type="number" />
              </label>
            </div>
            <label className="form-checkbox">
              <input name="taxable" type="checkbox" />
              <span>Taxable item</span>
            </label>
            <fieldset className="feature-flags">
              <legend>Homepage features</legend>
              <label><input name="featuredHome" type="checkbox" /> Recommended</label>
              <label><input name="featuredBanner" type="checkbox" /> Hero banner</label>
              <label><input name="featuredFresh" type="checkbox" /> Fresh today</label>
              <label><input name="featuredPopular" type="checkbox" /> Popular near you</label>
            </fieldset>
            <SubmitButton pendingLabel="Adding...">Add product</SubmitButton>
          </AdminActionForm>
        </section>

        <div>
          <AdminProductList
            activeCategory={activeCategory}
            activeQuery={activeQuery}
            activeStockFilter={activeStockFilter}
            categoryOptions={categoryOptions}
            products={visibleProducts}
          />
          {currentPage > 1 || hasNextPage ? (
            <nav className="pagination-row admin-pagination" aria-label="Admin product pagination">
              <a className={`button secondary${currentPage <= 1 ? " disabled" : ""}`} href={adminProductsPageHref(currentPage - 1, { category: activeCategory, q: activeQuery, stock: activeStockFilter })}>Previous</a>
              <span>Page {currentPage}</span>
              <a className={`button secondary${!hasNextPage ? " disabled" : ""}`} href={adminProductsPageHref(currentPage + 1, { category: activeCategory, q: activeQuery, stock: activeStockFilter })}>Next</a>
            </nav>
          ) : null}
        </div>
      </div>
    </main>
  )
}
