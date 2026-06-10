import Image from "next/image"

import { EmptyState, LowStockBadge } from "@/components/admin-static-ui"
import { AdminActionForm, AdminDeleteForm, ImagePreviewInput, SubmitButton } from "@/components/admin-ui"
import { ProductCategoryField } from "@/components/product-category-field"
import { deleteProduct, updateInventory, updateProduct } from "@/lib/actions"
import { discountedPriceCents, formatDiscountBadge, formatUnitPrice, titleCase } from "@/lib/format"

type AdminProduct = {
  id: string
  name: string
  description: string
  priceCents: number
  discountPercent: number | null
  discountType: "NONE" | "PERCENT" | "FIXED"
  discountValue: number | null
  imageUrl: string
  stock: number
  lowStockThreshold: number
  saleUnit: "EACH" | "LB"
  taxable: boolean
  featuredHome: boolean
  featuredBanner: boolean
  featuredFresh: boolean
  featuredPopular: boolean
  isActive: boolean
  category: { name: string }
}

function productDiscountType(product: AdminProduct) {
  if (product.discountType !== "NONE") {
    return product.discountType
  }

  return product.discountPercent && product.discountPercent > 0 ? "PERCENT" : "NONE"
}

function productDiscountValue(product: AdminProduct) {
  if (product.discountType === "FIXED") {
    return product.discountValue ? (product.discountValue / 100).toFixed(2) : ""
  }

  if (product.discountType === "PERCENT") {
    return product.discountValue ?? ""
  }

  return product.discountPercent ?? ""
}

export function AdminProductList({
  activeCategory = "",
  activeQuery = "",
  activeStockFilter = "all",
  canManageProducts = true,
  canUpdateInventory = true,
  categoryOptions,
  productCount,
  products
}: {
  activeCategory?: string
  activeQuery?: string
  activeStockFilter?: string
  canManageProducts?: boolean
  canUpdateInventory?: boolean
  categoryOptions: string[]
  productCount?: number
  products: AdminProduct[]
}) {
  return (
    <section className="admin-product-panel">
      <div className="admin-list-toolbar">
        <div>
          <h2>Products</h2>
          <p>{productCount ?? products.length} items on this page</p>
        </div>
        <form className="admin-product-server-filters" method="get">
          <label className="admin-search">
            <span>Search products</span>
            <input
              className="field"
              defaultValue={activeQuery}
              name="q"
              placeholder="Search by name or category"
              type="search"
            />
          </label>
          <div className="admin-product-filters">
            <label className="admin-search">
              <span>Category</span>
              <select className="select" defaultValue={activeCategory} name="category">
                <option value="">All categories</option>
                {categoryOptions.map((categoryName) => (
                  <option key={categoryName} value={categoryName}>{titleCase(categoryName)}</option>
                ))}
              </select>
            </label>
            <label className="admin-search">
              <span>Stock visibility</span>
              <select className="select" defaultValue={activeStockFilter} name="stock">
                <option value="all">All products</option>
                <option value="active">Active products</option>
                <option value="low">Low stock</option>
                <option value="out">Out of stock</option>
                <option value="hidden">Hidden products</option>
              </select>
            </label>
            <button className="button secondary" type="submit">Filter</button>
          </div>
        </form>
      </div>
      <div className="admin-list">
        {products.length === 0 ? (
          <EmptyState
            title={activeQuery || activeCategory || activeStockFilter !== "all" ? "No matching products" : "No products yet"}
            message={activeQuery || activeCategory || activeStockFilter !== "all" ? "Try a different product name, category, or stock filter." : "Add your first grocery item to start building the storefront."}
          />
        ) : (
          products.map((product, index) => {
            const effectivePrice = discountedPriceCents(product.priceCents, product.discountType, product.discountValue, product.discountPercent)
            const discountBadge = formatDiscountBadge(product.priceCents, product.discountType, product.discountValue, product.discountPercent)

            return (
              <article className="admin-card" key={product.id}>
                <div className="admin-card-media">
                  <Image alt={product.name} height={96} priority={index === 0} src={product.imageUrl} style={{ height: "auto" }} width={96} />
                </div>
                <div className="admin-card-main">
                  <div className="admin-card-head">
                    <div className="admin-product-summary">
                      <p className="muted">{titleCase(product.category.name)}</p>
                      <h2>{titleCase(product.name)}</h2>
                      <LowStockBadge lowStockThreshold={product.lowStockThreshold} saleUnit={product.saleUnit} stock={product.stock} />
                      {!product.isActive ? <span className="stock-warning empty">Hidden</span> : null}
                    </div>
                    <div className="admin-price">
                      {effectivePrice < product.priceCents ? <span className="original-price">{formatUnitPrice(product.priceCents, product.saleUnit)}</span> : null}
                      <span>{formatUnitPrice(effectivePrice, product.saleUnit)}</span>
                      {discountBadge ? <small>{discountBadge}</small> : null}
                    </div>
                  </div>
                  {canManageProducts ? (
                    <details className="admin-details">
                      <summary className="button secondary">Edit product</summary>
                      <AdminActionForm action={updateProduct.bind(null, product.id)}>
                      <ImagePreviewInput currentImage={product.imageUrl} label="Product image" uploadEndpoint="/api/admin/uploads/product-image" />
                      <label className="form-field">
                        <span>Product name</span>
                        <input className="field" defaultValue={product.name} name="name" required />
                      </label>
                      <label className="form-field">
                        <span>Description</span>
                        <textarea className="textarea" defaultValue={product.description} name="description" required />
                      </label>
                      <ProductCategoryField categories={categoryOptions} defaultValue={product.category.name} />
                      <div className="form-row">
                        <label className="form-field">
                          <span>Sold by</span>
                          <select className="select" defaultValue={product.saleUnit} name="saleUnit" required>
                            <option value="EACH">Each</option>
                            <option value="LB">Pound</option>
                          </select>
                        </label>
                        <label className="form-field">
                          <span>Price</span>
                          <input className="field" defaultValue={(product.priceCents / 100).toFixed(2)} min="0" name="price" required step="0.01" type="number" />
                        </label>
                      </div>
                      <div className="form-row">
                        <label className="form-field">
                          <span>Discount type</span>
                          <select className="select" defaultValue={productDiscountType(product)} name="discountType">
                            <option value="NONE">None</option>
                            <option value="PERCENT">Percent</option>
                            <option value="FIXED">Fixed amount</option>
                          </select>
                        </label>
                        <label className="form-field">
                          <span>Discount value</span>
                          <input className="field" defaultValue={productDiscountValue(product)} min="0" name="discountValue" placeholder="10 or 2.00" step="0.01" type="number" />
                        </label>
                      </div>
                      <div className="form-row">
                        <label className="form-field">
                          <span>Stock</span>
                          <input className="field" defaultValue={product.stock} min="0" name="stock" required step="0.01" type="number" />
                        </label>
                        <label className="form-field">
                          <span>Low stock threshold</span>
                          <input className="field" defaultValue={product.lowStockThreshold} min="0" name="lowStockThreshold" required step="0.01" type="number" />
                        </label>
                      </div>
                      <label className="form-checkbox">
                        <input defaultChecked={product.taxable} name="taxable" type="checkbox" />
                        <span>Taxable item</span>
                      </label>
                      <fieldset className="feature-flags">
                        <legend>Homepage features</legend>
                        <label><input defaultChecked={product.featuredHome} name="featuredHome" type="checkbox" /> Recommended</label>
                        <label><input defaultChecked={product.featuredBanner} name="featuredBanner" type="checkbox" /> Hero banner</label>
                        <label><input defaultChecked={product.featuredFresh} name="featuredFresh" type="checkbox" /> Fresh today</label>
                        <label><input defaultChecked={product.featuredPopular} name="featuredPopular" type="checkbox" /> Popular near you</label>
                      </fieldset>
                        <SubmitButton pendingLabel="Saving..." variant="secondary">Save changes</SubmitButton>
                      </AdminActionForm>
                    </details>
                  ) : null}

                  <div className="admin-card-actions">
                    {canUpdateInventory ? (
                      <>
                        <AdminActionForm action={updateInventory.bind(null, product.id)} className="quick-inventory-form">
                          <input name="mode" type="hidden" value="SET" />
                          <input name="quantity" type="hidden" value={Math.max(0, Number((product.stock - (product.saleUnit === "LB" ? 0.5 : 1)).toFixed(2)))} />
                          <input name="lowStockThreshold" type="hidden" value={product.lowStockThreshold} />
                          <button aria-label={`Reduce ${product.name} inventory`} className="copy-button" disabled={product.stock <= 0} type="submit">-</button>
                        </AdminActionForm>
                        <AdminActionForm action={updateInventory.bind(null, product.id)} className="quick-inventory-form">
                          <input name="mode" type="hidden" value="ADD" />
                          <input name="quantity" type="hidden" value={product.saleUnit === "LB" ? 0.5 : 1} />
                          <input name="lowStockThreshold" type="hidden" value={product.lowStockThreshold} />
                          <button aria-label={`Increase ${product.name} inventory`} className="copy-button" type="submit">+</button>
                        </AdminActionForm>
                      </>
                    ) : null}
                    {canManageProducts ? (
                      <AdminDeleteForm
                        action={deleteProduct.bind(null, product.id)}
                        confirmMessage={`Delete ${titleCase(product.name)} from the storefront?`}
                        label="Delete"
                      />
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}
