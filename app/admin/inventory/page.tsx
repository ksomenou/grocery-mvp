import Image from "next/image"
import Link from "next/link"

import { AdminNav } from "@/components/admin-nav"
import { EmptyState, LowStockBadge } from "@/components/admin-static-ui"
import { InventoryUpdateForm } from "@/components/inventory-update-form"
import { formatQuantity, titleCase } from "@/lib/format"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function AdminInventoryPage({
  searchParams
}: {
  searchParams: Promise<{ filter?: string; q?: string }>
}) {
  const { filter, q } = await searchParams
  const query = q?.trim()
  const products = await prisma.product.findMany({
    where: {
      ...(filter === "active" ? { isActive: true } : {}),
      ...(filter === "sold-out" ? { stock: { lte: 0 } } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              { category: { name: { contains: query, mode: "insensitive" as const } } }
            ]
          }
        : {})
    },
    include: { category: true },
    orderBy: [{ stock: "asc" }, { name: "asc" }]
  })
  const filteredProducts = filter === "low-stock"
    ? products.filter((product) => product.stock > 0 && product.stock <= product.lowStockThreshold)
    : products
  const [activeProducts, lowStockCount, soldOutCount] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.findMany({ where: { isActive: true, stock: { gt: 0 } }, select: { stock: true, lowStockThreshold: true } }),
    prisma.product.count({ where: { isActive: true, stock: { lte: 0 } } })
  ])
  const realLowStockCount = lowStockCount.filter((product) => product.stock <= product.lowStockThreshold).length

  return (
    <main className="shell">
      <div className="page-title">
        <p className="admin-kicker">Store admin</p>
        <h1>Inventory</h1>
        <p>Restock products, monitor low stock, and keep grocery availability accurate.</p>
        <Link className="button secondary admin-header-action" href="/admin/products" prefetch={false}>Add product</Link>
        <AdminNav active="dashboard" />
      </div>

      <section className="admin-metrics dense">
        <article className="metric-card healthy"><span><b>P</b> Active products</span><strong>{activeProducts}</strong><small>Visible storefront items</small></article>
        <article className={realLowStockCount > 0 ? "metric-card low" : "metric-card healthy"}><span><b>S</b> Low stock</span><strong>{realLowStockCount}</strong><small>At or below threshold</small></article>
        <article className={soldOutCount > 0 ? "metric-card urgent" : "metric-card healthy"}><span><b>O</b> Sold out</span><strong>{soldOutCount}</strong><small>Need restock</small></article>
      </section>

      <form className="admin-filter-bar" action="/admin/inventory">
        <label>
          <span>Search inventory</span>
          <input className="field" defaultValue={query ?? ""} name="q" placeholder="Name or category" />
        </label>
        <label>
          <span>Filter</span>
          <select className="select" defaultValue={filter ?? "all"} name="filter">
            <option value="all">All products</option>
            <option value="low-stock">Low stock</option>
            <option value="sold-out">Sold out</option>
            <option value="active">Active only</option>
          </select>
        </label>
        <button className="button secondary" type="submit">Filter</button>
      </form>

      <section className="admin-list single inventory-admin-list">
        {filteredProducts.length === 0 ? (
          <EmptyState title="No products match" message="Try a different inventory filter or search term." />
        ) : filteredProducts.map((product, index) => (
          <article className="admin-card" key={product.id}>
            <div className="admin-card-media">
              <Image alt={product.name} height={96} priority={index === 0} src={product.imageUrl} width={96} />
            </div>
            <div className="admin-card-main">
              <div className="admin-card-head">
                <div className="admin-product-summary">
                  <p className="muted">{titleCase(product.category.name)}</p>
                  <h2>{titleCase(product.name)}</h2>
                  <p className="muted">{product.isActive ? "Active" : "Inactive"} storefront item</p>
                  <LowStockBadge lowStockThreshold={product.lowStockThreshold} saleUnit={product.saleUnit} stock={product.stock} />
                </div>
                <div className="admin-price">
                  <span>{formatQuantity(product.stock, product.saleUnit)}</span>
                  <small>Threshold {formatQuantity(product.lowStockThreshold, product.saleUnit)}</small>
                </div>
              </div>
              <InventoryUpdateForm currentThreshold={product.lowStockThreshold} productId={product.id} />
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
