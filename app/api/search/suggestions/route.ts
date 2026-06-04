import { NextResponse } from "next/server"

import { discountedPriceCents } from "@/lib/format"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.trim()

  if (!query) {
    return NextResponse.json({ suggestions: [] })
  }

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { category: { name: { contains: query, mode: "insensitive" } } }
      ]
    },
    include: { category: true },
    orderBy: { updatedAt: "desc" },
    take: 6
  })

  return NextResponse.json({
    suggestions: products.map((product) => ({
      categoryName: product.category.name,
      imageUrl: product.imageUrl,
      name: product.name,
      priceCents: discountedPriceCents(product.priceCents, product.discountType, product.discountValue, product.discountPercent),
      slug: product.slug
    }))
  })
}
