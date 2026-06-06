import { AdminNav } from "@/components/admin-nav"
import { AdminProductList } from "@/components/admin-product-list"
import { AdminActionForm, ImagePreviewInput, SubmitButton } from "@/components/admin-ui"
import { ProductCategoryField } from "@/components/product-category-field"
import { createProduct } from "@/lib/actions"
import { defaultCategoryNames } from "@/lib/default-categories"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function AdminProductsPage() {
  const [categories, products, pendingOrders, lowStockProducts] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ include: { category: true }, orderBy: { createdAt: "desc" } }),
    prisma.order.count({ where: { status: { in: ["RECEIVED", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"] } } }),
    prisma.product.findMany({
      where: { isActive: true, stock: { gt: 0 } },
      select: { id: true, lowStockThreshold: true, stock: true }
    })
  ])
  const lowStockCount = lowStockProducts.filter((product) => product.stock <= product.lowStockThreshold).length
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

        <AdminProductList categoryOptions={categoryOptions} products={products} />
      </div>
    </main>
  )
}
