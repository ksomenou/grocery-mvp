import { PrismaClient } from "@prisma/client"

import { defaultCategoryNames } from "../lib/default-categories"
import { slugify } from "../lib/format"

const prisma = new PrismaClient()

const legacyCategoryName = "Laundry & Cleaning"
const legacyCategorySlug = "laundry-cleaning"
const replacementCategoryName = "Health & Beauty"
const replacementCategorySlug = "health-beauty"

async function migrateHealthBeautyCategory() {
  const [legacyCategory, replacementCategory] = await Promise.all([
    prisma.category.findFirst({
      where: {
        OR: [
          { name: { equals: legacyCategoryName, mode: "insensitive" } },
          { slug: legacyCategorySlug }
        ]
      }
    }),
    prisma.category.findFirst({
      where: {
        OR: [
          { name: { equals: replacementCategoryName, mode: "insensitive" } },
          { slug: replacementCategorySlug }
        ]
      }
    })
  ])

  if (legacyCategory && replacementCategory && legacyCategory.id !== replacementCategory.id) {
    await prisma.product.updateMany({
      where: { categoryId: legacyCategory.id },
      data: { categoryId: replacementCategory.id }
    })
    await prisma.category.delete({ where: { id: legacyCategory.id } })
    return
  }

  if (legacyCategory) {
    await prisma.category.update({
      where: { id: legacyCategory.id },
      data: {
        name: replacementCategoryName,
        slug: replacementCategorySlug
      }
    })
  }
}

async function main() {
  await migrateHealthBeautyCategory()

  for (const name of defaultCategoryNames) {
    const slug = name === replacementCategoryName ? replacementCategorySlug : slugify(name)
    const existing = await prisma.category.findFirst({
      where: {
        OR: [
          { slug },
          { name: { equals: name, mode: "insensitive" } }
        ]
      }
    })

    if (existing) {
      await prisma.category.update({
        where: { id: existing.id },
        data: {
          name,
          slug
        }
      })
      continue
    }

    await prisma.category.create({
      data: {
        name,
        slug,
        description: `Products grouped under ${name}.`,
        imageUrl: "/images/placeholder.svg"
      }
    })
  }
}

main()
  .catch((error) => {
    console.error("[seed categories]", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
