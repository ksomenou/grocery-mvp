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

function adminProductsPageHref(page: number) {
  return page > 1 ? `/admin/products?page=${page}` : "/admin/products"
}

export default async function AdminProductsPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page } = await searchParams
  const currentPage = Math.max(1, Number(page) || 1)
  const timer = createQueryTimer("admin/products")
  const [categories, products, productCount, pendingOrders, lowStockRows] = await Promise.all([
    timer.run("categories", () => prisma.category.findMany({ orderBy: { name: "asc" }, select: { name: true } })),
    timer.run("products page", () =>
      prisma.product.findMany({
        orderBy: { createdAt: "desc" },
        select: adminProductSelect,
        skip: (currentPage - 1) * adminProductPageSize,
        take: adminProductPageSize
      })
    ),
    timer.run("product count", () => prisma.product.count()),
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
  const lowStockCount = Number(lowStockRows[0]?.count ?? 0)
  const categoryOptions = Array.from(
    new Set([...defaultCategoryNames, ...categories.map((category) => category.name)])
  )
  const totalPages = Math.max(1, Math.ceil(productCount / adminProductPageSize))

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
          <AdminProductList categoryOptions={categoryOptions} productCount={productCount} products={products} />
          {productCount > adminProductPageSize ? (
            <nav className="pagination-row admin-pagination" aria-label="Admin product pagination">
              <a className={`button secondary${currentPage <= 1 ? " disabled" : ""}`} href={adminProductsPageHref(currentPage - 1)}>Previous</a>
              <span>Page {currentPage} of {totalPages}</span>
              <a className={`button secondary${currentPage >= totalPages ? " disabled" : ""}`} href={adminProductsPageHref(currentPage + 1)}>Next</a>
            </nav>
          ) : null}
        </div>
      </div>
    </main>
  )
}
