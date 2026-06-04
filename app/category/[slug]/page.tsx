import { notFound } from "next/navigation"

import { ProductCard } from "@/components/product-card"
import { titleCase } from "@/lib/format"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function CategoryPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  if (!slug) {
    notFound()
  }

  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      products: {
        where: { isActive: true },
        include: { category: true },
        orderBy: { name: "asc" }
      }
    }
  })

  if (!category) {
    notFound()
  }

  return (
    <main className="shell">
      <div className="page-title">
        <h1>{titleCase(category.name)}</h1>
        <p>{category.description}</p>
      </div>
      <div className="grid product-grid section">
        {category.products.length > 0 ? (
          category.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))
        ) : (
          <div className="empty-state product-empty-state">
            <h3>No Products Yet</h3>
            <p>This category is ready, but products have not been added yet.</p>
          </div>
        )}
      </div>
    </main>
  )
}
