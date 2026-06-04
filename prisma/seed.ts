import { PrismaClient } from "@prisma/client"
import { SaleUnit } from "@prisma/client"

const prisma = new PrismaClient()

const categories = [
  {
    name: "Fresh Produce",
    slug: "fresh-produce",
    description: "Crisp fruits, leafy greens, and everyday vegetables.",
    imageUrl: "/images/avocados.svg"
  },
  {
    name: "Bakery",
    slug: "bakery",
    description: "Fresh bread, pastries, and breakfast favorites.",
    imageUrl: "/images/sourdough.svg"
  },
  {
    name: "Dairy & Eggs",
    slug: "dairy-eggs",
    description: "Milk, cheese, yogurt, butter, and farm eggs.",
    imageUrl: "/images/eggs.svg"
  },
  {
    name: "Pantry",
    slug: "pantry",
    description: "Reliable staples for quick meals and weekly cooking.",
    imageUrl: "/images/pasta.svg"
  }
]

const products = [
  ["Organic Bananas", "organic-bananas", "Sweet bunches ready for smoothies, cereal, or snacking.", 149, "/images/bananas.svg", 42, SaleUnit.LB, "fresh-produce"],
  ["Avocado Bag", "avocado-bag", "Creamy Hass avocados packed for salads, toast, and tacos.", 599, "/images/avocados.svg", 18, SaleUnit.EACH, "fresh-produce"],
  ["Sourdough Loaf", "sourdough-loaf", "Naturally leavened loaf with a crisp crust and tender crumb.", 699, "/images/sourdough.svg", 12, SaleUnit.EACH, "bakery"],
  ["Croissant 4 Pack", "croissant-4-pack", "Buttery, flaky croissants baked fresh each morning.", 899, "/images/croissants.svg", 16, SaleUnit.EACH, "bakery"],
  ["Pasture Eggs", "pasture-eggs", "One dozen large pasture-raised eggs.", 749, "/images/eggs.svg", 24, SaleUnit.EACH, "dairy-eggs"],
  ["Greek Yogurt", "greek-yogurt", "Thick plain Greek yogurt for bowls, sauces, and baking.", 549, "/images/yogurt.svg", 20, SaleUnit.EACH, "dairy-eggs"],
  ["Penne Pasta", "penne-pasta", "Bronze-cut pasta for weeknight dinners.", 329, "/images/pasta.svg", 36, SaleUnit.EACH, "pantry"],
  ["Extra Virgin Olive Oil", "extra-virgin-olive-oil", "Smooth finishing and cooking oil in a pantry-friendly bottle.", 1299, "/images/olive-oil.svg", 14, SaleUnit.EACH, "pantry"]
] as const

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category
    })
  }

  for (const [name, slug, description, priceCents, imageUrl, stock, saleUnit, categorySlug] of products) {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: categorySlug } })
    await prisma.product.upsert({
      where: { slug },
      update: { name, description, priceCents, imageUrl, stock, saleUnit, isActive: true, categoryId: category.id },
      create: { name, slug, description, priceCents, imageUrl, stock, saleUnit, categoryId: category.id }
    })
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
