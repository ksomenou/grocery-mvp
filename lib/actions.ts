"use server"

import { DiscountCodeType, DiscountScope, DiscountType, Prisma, SaleUnit } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { z } from "zod"

import { requireAdmin } from "@/lib/admin-auth"
import { normalizeDiscountCode } from "@/lib/discounts"
import { slugify } from "@/lib/format"
import { notifyOrderStatusChanged } from "@/lib/notifications"
import { createOperationalEvent } from "@/lib/operational-events"
import { adminOrderStatuses, assertValidOrderTransition, isFulfillmentStatus } from "@/lib/orders"
import { prisma } from "@/lib/prisma"

export type ActionState = {
  ok: boolean
  message: string
}

const initialActionState: ActionState = {
  ok: false,
  message: ""
}

const productBaseSchema = z.object({
  name: z.string().min(2, "Product name is required."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  categoryName: z.string().min(2, "Product category is required."),
  saleUnit: z.nativeEnum(SaleUnit, { errorMap: () => ({ message: "Sold by must be Each or Pound." }) }),
  price: z.coerce.number().positive("Price must be greater than 0."),
  discountType: z.nativeEnum(DiscountType).default(DiscountType.NONE),
  discountValue: z.coerce.number().min(0, "Discount value cannot be negative.").optional(),
  stock: z.coerce.number().min(0, "Stock cannot be negative."),
  lowStockThreshold: z.coerce.number().min(0, "Low stock threshold cannot be negative.").default(5),
  taxable: z.boolean(),
  featuredHome: z.boolean(),
  featuredBanner: z.boolean(),
  featuredFresh: z.boolean(),
  featuredPopular: z.boolean()
}).superRefine((data, context) => {
  const value = data.discountValue ?? 0

  if (data.discountType === DiscountType.PERCENT && (value < 0 || value > 100)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Percent discount must be between 0 and 100.",
      path: ["discountValue"]
    })
  }

  if (data.discountType === DiscountType.FIXED && value > data.price) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Fixed discount cannot be greater than the product price.",
      path: ["discountValue"]
    })
  }
})

const createProductSchema = productBaseSchema
const productSchema = productBaseSchema

const categorySchema = z.object({
  name: z.string().min(2),
  description: z.string().min(8)
})

const optionalDiscountNumber = (message: string) =>
  z.preprocess(
    (value) => value === "" || value === null ? undefined : value,
    z.coerce.number().finite(message).optional()
  )

const optionalDiscountDate = z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.string().optional()
)

const discountCodeSchema = z.object({
  code: z.preprocess(
    (value) => normalizeDiscountCode(String(value ?? "")),
    z.string().min(2, "Discount code is required.").regex(/^[A-Z0-9_-]+$/, "Use only letters, numbers, hyphens, or underscores for the code.")
  ),
  type: z.nativeEnum(DiscountCodeType, { errorMap: () => ({ message: "Choose percent or fixed amount." }) }),
  scope: z.nativeEnum(DiscountScope).default(DiscountScope.ORDER),
  productId: z.preprocess((value) => value === "" || value === null ? undefined : value, z.string().optional()),
  percentOff: optionalDiscountNumber("Enter a valid percent discount."),
  amountOff: optionalDiscountNumber("Enter a valid fixed discount amount."),
  isActive: z.boolean(),
  startsAt: optionalDiscountDate,
  endsAt: optionalDiscountDate,
  maxRedemptions: optionalDiscountNumber("Enter a valid max redemptions value."),
  minimumOrderAmount: optionalDiscountNumber("Enter a valid minimum order amount.")
}).superRefine((data, context) => {
  if (data.percentOff !== undefined && data.percentOff < 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Percent discount cannot be negative.",
      path: ["percentOff"]
    })
  }

  if (data.amountOff !== undefined && data.amountOff < 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Fixed discount cannot be negative.",
      path: ["amountOff"]
    })
  }

  if (data.type === DiscountCodeType.PERCENT && (!data.percentOff || data.percentOff < 1 || data.percentOff > 100)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Percent discount must be between 1 and 100.",
      path: ["percentOff"]
    })
  }

  if (data.type === DiscountCodeType.FIXED && (!data.amountOff || data.amountOff <= 0)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Fixed discount must be greater than 0.",
      path: ["amountOff"]
    })
  }

  if (data.scope === DiscountScope.PRODUCT && !data.productId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Choose a product for product-specific discounts.",
      path: ["productId"]
    })
  }

  if (data.maxRedemptions !== undefined && (!Number.isInteger(data.maxRedemptions) || data.maxRedemptions <= 0)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Max redemptions must be a positive whole number.",
      path: ["maxRedemptions"]
    })
  }

  if (data.minimumOrderAmount !== undefined && data.minimumOrderAmount < 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Minimum order cannot be negative.",
      path: ["minimumOrderAmount"]
    })
  }

  const startsAt = data.startsAt ? new Date(data.startsAt) : null
  const endsAt = data.endsAt ? new Date(data.endsAt) : null

  if (startsAt && Number.isNaN(startsAt.getTime())) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Start date is invalid.",
      path: ["startsAt"]
    })
  }

  if (endsAt && Number.isNaN(endsAt.getTime())) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "End date is invalid.",
      path: ["endsAt"]
    })
  }

  if (startsAt && endsAt && !Number.isNaN(startsAt.getTime()) && !Number.isNaN(endsAt.getTime()) && startsAt > endsAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "End date must be after start date.",
      path: ["endsAt"]
    })
  }
})

const inventorySchema = z.object({
  mode: z.enum(["ADD", "SET"]).default("ADD"),
  quantity: z.preprocess((value) => value === "" ? undefined : value, z.coerce.number().finite("Enter a valid stock quantity.").optional()),
  lowStockThreshold: z.coerce.number().finite("Enter a valid low stock threshold.").min(0, "Low stock threshold cannot be negative.").max(10000, "Low stock threshold is too high.")
}).superRefine((data, context) => {
  if (data.quantity === undefined) {
    return
  }

  if (data.mode === "ADD" && data.quantity <= 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Add stock quantity must be greater than 0.",
      path: ["quantity"]
    })
  }

  if (data.mode === "SET" && data.quantity < 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Stock cannot be negative.",
      path: ["quantity"]
    })
  }
})

async function saveImage(file: File | null, fallback?: string) {
  if (!file || file.size === 0) {
    return fallback ?? "/images/placeholder.svg"
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const safeName = `${Date.now()}-${file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-")}`
  const uploadPath = path.join(process.cwd(), "public", "uploads", safeName)
  await writeFile(uploadPath, bytes)
  return `/uploads/${safeName}`
}

async function findOrCreateCategory(categoryName: string) {
  const name = categoryName.trim()
  const existing = await prisma.category.findFirst({
    where: { name: { equals: name, mode: "insensitive" } }
  })

  if (existing) {
    return existing
  }

  return prisma.category.create({
    data: {
      name,
      slug: `${slugify(name)}-${Date.now().toString(36)}`,
      description: `Products grouped under ${name}.`,
      imageUrl: "/images/placeholder.svg"
    }
  })
}

function readProductFormData(formData: FormData | null | undefined) {
  if (!(formData instanceof FormData)) {
    throw new Error("Product form was not submitted correctly. Please try again.")
  }

  return {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    categoryName: String(formData.get("categoryName") ?? formData.get("category") ?? "").trim(),
    saleUnit: String(formData.get("saleUnit") ?? "EACH"),
    price: formData.get("price") ?? "",
    discountType: formData.get("discountType") || DiscountType.NONE,
    discountValue: formData.get("discountValue") || undefined,
    stock: formData.get("stock") ?? "",
    lowStockThreshold: formData.get("lowStockThreshold") ?? "5",
    taxable: formData.get("taxable") === "on",
    featuredHome: formData.get("featuredHome") === "on",
    featuredBanner: formData.get("featuredBanner") === "on",
    featuredFresh: formData.get("featuredFresh") === "on",
    featuredPopular: formData.get("featuredPopular") === "on",
    imageUrl: String(formData.get("imageUrl") ?? "").trim()
  }
}

function discountFields(data: z.infer<typeof productBaseSchema>) {
  if (data.discountType === DiscountType.PERCENT && data.discountValue && data.discountValue > 0) {
    const percent = Math.round(data.discountValue)
    return {
      discountType: DiscountType.PERCENT,
      discountValue: percent,
      discountPercent: percent
    }
  }

  if (data.discountType === DiscountType.FIXED && data.discountValue && data.discountValue > 0) {
    return {
      discountType: DiscountType.FIXED,
      discountValue: Math.round(data.discountValue * 100),
      discountPercent: null
    }
  }

  return {
    discountType: DiscountType.NONE,
    discountValue: null,
    discountPercent: null
  }
}

function readImageFile(formData: FormData | null | undefined) {
  if (!(formData instanceof FormData)) {
    return null
  }

  const image = formData.get("image")
  return image instanceof File ? image : null
}

export async function createProduct(_state: ActionState = initialActionState, formData?: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    const productForm = readProductFormData(formData)
    const data = createProductSchema.parse(productForm)
    const imageUrl = productForm.imageUrl || await saveImage(readImageFile(formData))
    const category = await findOrCreateCategory(data.categoryName)
    const slug = `${slugify(data.name)}-${Date.now().toString(36)}`

    await prisma.product.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        categoryId: category.id,
        saleUnit: data.saleUnit,
        priceCents: Math.round(data.price * 100),
        ...discountFields(data),
        stock: data.stock,
        lowStockThreshold: data.lowStockThreshold,
        taxable: data.taxable,
        featuredHome: data.featuredHome,
        featuredBanner: data.featuredBanner,
        featuredFresh: data.featuredFresh,
        featuredPopular: data.featuredPopular,
        imageUrl
      }
    })

    await createOperationalEvent({
      type: data.discountType === DiscountType.NONE ? "product_created" : "discount_created",
      message: data.discountType === DiscountType.NONE ? `Product created: ${data.name}` : `Discount created for ${data.name}`,
      metadata: { productName: data.name, categoryName: category.name }
    })

    revalidateAdmin()
    return { ok: true, message: "Product added." }
  } catch (error) {
    return actionError(error, "Could not add product.")
  }
}

export async function updateProduct(productId: string, _state: ActionState = initialActionState, formData?: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    const productForm = readProductFormData(formData)
    const data = productSchema.parse(productForm)
    const current = await prisma.product.findUniqueOrThrow({ where: { id: productId } })
    const imageUrl = productForm.imageUrl || await saveImage(readImageFile(formData), current.imageUrl)
    const category = await findOrCreateCategory(data.categoryName)

    const oldStock = current.stock
    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        name: data.name,
        description: data.description,
        categoryId: category.id,
        saleUnit: data.saleUnit,
        priceCents: Math.round(data.price * 100),
        ...discountFields(data),
        stock: data.stock,
        lowStockThreshold: data.lowStockThreshold,
        taxable: data.taxable,
        featuredHome: data.featuredHome,
        featuredBanner: data.featuredBanner,
        featuredFresh: data.featuredFresh,
        featuredPopular: data.featuredPopular,
        imageUrl
      }
    })

    if (data.stock > oldStock) {
      await createOperationalEvent({
        type: "inventory_restocked",
        message: `Inventory restocked: ${updated.name}`,
        metadata: { productId, productName: updated.name, previousStock: oldStock, stock: data.stock }
      })
    }

    if (data.stock > 0 && data.stock <= data.lowStockThreshold) {
      await createOperationalEvent({
        type: "low_stock_detected",
        message: `Low stock detected: ${updated.name}`,
        metadata: { productId, productName: updated.name, stock: data.stock }
      })
    }

    if (data.stock <= 0 && oldStock > 0) {
      await createOperationalEvent({
        type: "product_sold_out",
        message: `Product sold out: ${updated.name}`,
        metadata: { productId, productName: updated.name }
      })
    }

    if (data.discountType !== DiscountType.NONE) {
      await createOperationalEvent({
        type: "discount_created",
        message: `Discount updated for ${updated.name}`,
        metadata: { productId, productName: updated.name }
      })
    }

    revalidateAdmin()
    return { ok: true, message: "Product updated." }
  } catch (error) {
    return actionError(error, "Could not update product.")
  }
}

export async function deleteProduct(productId: string, _state: ActionState = initialActionState): Promise<ActionState> {
  try {
    await requireAdmin()
    await prisma.product.update({ where: { id: productId }, data: { isActive: false } })
    revalidateAdmin()
    return { ok: true, message: "Product removed from the storefront." }
  } catch (error) {
    return actionError(error, "Could not delete product.")
  }
}

export async function createCategory(_state: ActionState = initialActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    const data = categorySchema.parse(Object.fromEntries(formData))
    const imageUrl = await saveImage(formData.get("image") as File | null)
    const slug = `${slugify(data.name)}-${Date.now().toString(36)}`

    await prisma.category.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        imageUrl
      }
    })

    revalidateAdmin()
    return { ok: true, message: "Category added." }
  } catch (error) {
    return actionError(error, "Could not add category.")
  }
}

export async function updateCategory(categoryId: string, _state: ActionState = initialActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    const data = categorySchema.parse(Object.fromEntries(formData))
    const current = await prisma.category.findUniqueOrThrow({ where: { id: categoryId } })
    const imageUrl = await saveImage(formData.get("image") as File | null, current.imageUrl)

    await prisma.category.update({
      where: { id: categoryId },
      data: {
        name: data.name,
        description: data.description,
        imageUrl
      }
    })

    revalidateAdmin()
    return { ok: true, message: "Category updated." }
  } catch (error) {
    return actionError(error, "Could not update category.")
  }
}

export async function deleteCategory(categoryId: string, _state: ActionState = initialActionState): Promise<ActionState> {
  try {
    await requireAdmin()
    const activeProducts = await prisma.product.count({ where: { categoryId, isActive: true } })
    if (activeProducts > 0) {
      return { ok: false, message: "Move or delete products in this category first." }
    }

    await prisma.category.delete({ where: { id: categoryId } })
    revalidateAdmin()
    return { ok: true, message: "Category deleted." }
  } catch (error) {
    return actionError(error, "Could not delete category.")
  }
}

function optionalDate(value?: string) {
  return value ? new Date(value) : null
}

function optionalCents(value?: number) {
  return value && value > 0 ? Math.round(value * 100) : null
}

async function validateDiscountProduct(data: z.infer<typeof discountCodeSchema>) {
  if (data.scope !== DiscountScope.PRODUCT) {
    return null
  }

  const product = await prisma.product.findFirst({
    where: { id: data.productId, isActive: true },
    select: { id: true, name: true, priceCents: true }
  })
  if (!product) {
    throw new Error("Choose an active product for this product-specific discount.")
  }

  if (data.type === DiscountCodeType.FIXED && data.amountOff && Math.round(data.amountOff * 100) > product.priceCents) {
    throw new Error("Fixed product discount cannot exceed the selected product price.")
  }

  return product
}

function readDiscountCodeFormData(formData: FormData | null | undefined) {
  if (!(formData instanceof FormData)) {
    throw new Error("Discount form was not submitted correctly.")
  }

  const productId = formData.get("productId")

  return {
    code: formData.get("code"),
    type: formData.get("type"),
    scope: productId ? DiscountScope.PRODUCT : formData.get("scope") || DiscountScope.ORDER,
    productId,
    percentOff: formData.get("percentOff"),
    amountOff: formData.get("amountOff"),
    isActive: formData.get("isActive") === "on",
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    maxRedemptions: formData.get("maxRedemptions"),
    minimumOrderAmount: formData.get("minimumOrderAmount")
  }
}

export async function createDiscountCode(_state: ActionState = initialActionState, formData?: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    const data = discountCodeSchema.parse(readDiscountCodeFormData(formData))
    const product = await validateDiscountProduct(data)

    const existing = await prisma.discountCode.findUnique({ where: { code: data.code } })
    if (existing) {
      throw new Error("A discount with that code already exists.")
    }

    await prisma.discountCode.create({
      data: {
        code: data.code,
        type: data.type,
        scope: product ? DiscountScope.PRODUCT : DiscountScope.ORDER,
        productId: product?.id ?? null,
        percentOff: data.type === DiscountCodeType.PERCENT ? Math.round(data.percentOff ?? 0) : null,
        amountOffCents: data.type === DiscountCodeType.FIXED ? optionalCents(data.amountOff) : null,
        isActive: data.isActive,
        startsAt: optionalDate(data.startsAt),
        endsAt: optionalDate(data.endsAt),
        maxRedemptions: data.maxRedemptions ?? null,
        minimumOrderCents: optionalCents(data.minimumOrderAmount)
      }
    })

    await createOperationalEvent({
      type: "discount_created",
      message: `Discount code created: ${data.code}`,
      metadata: { code: data.code }
    })
    revalidatePath("/admin")
    revalidatePath("/admin/discounts")
    return { ok: true, message: "Discount code created." }
  } catch (error) {
    return actionError(error, "Could not create discount code.")
  }
}

export async function disableDiscountCode(discountId: string, _state: ActionState = initialActionState): Promise<ActionState> {
  try {
    await requireAdmin()
    await prisma.discountCode.update({
      where: { id: discountId },
      data: { isActive: false }
    })
    revalidatePath("/admin/discounts")
    return { ok: true, message: "Discount disabled." }
  } catch (error) {
    return actionError(error, "Could not disable discount.")
  }
}

export async function enableDiscountCode(discountId: string, _state: ActionState = initialActionState): Promise<ActionState> {
  try {
    await requireAdmin()
    await prisma.discountCode.update({
      where: { id: discountId },
      data: { isActive: true }
    })
    revalidatePath("/admin/discounts")
    return { ok: true, message: "Discount enabled." }
  } catch (error) {
    return actionError(error, "Could not enable discount.")
  }
}

export async function deleteDiscountCode(discountId: string, _state: ActionState = initialActionState): Promise<ActionState> {
  try {
    await requireAdmin()
    await prisma.discountCode.update({
      where: { id: discountId },
      data: { isActive: false }
    })
    revalidatePath("/admin/discounts")
    return { ok: true, message: "Discount archived." }
  } catch (error) {
    return actionError(error, "Could not archive discount.")
  }
}

export async function updateDiscountCode(discountId: string, _state: ActionState = initialActionState, formData?: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    const data = discountCodeSchema.parse(readDiscountCodeFormData(formData))
    const product = await validateDiscountProduct(data)

    const duplicate = await prisma.discountCode.findFirst({
      where: {
        code: data.code,
        NOT: { id: discountId }
      }
    })
    if (duplicate) {
      throw new Error("A discount with that code already exists.")
    }

    await prisma.discountCode.update({
      where: { id: discountId },
      data: {
        code: data.code,
        type: data.type,
        scope: product ? DiscountScope.PRODUCT : DiscountScope.ORDER,
        productId: product?.id ?? null,
        percentOff: data.type === DiscountCodeType.PERCENT ? Math.round(data.percentOff ?? 0) : null,
        amountOffCents: data.type === DiscountCodeType.FIXED ? optionalCents(data.amountOff) : null,
        isActive: data.isActive,
        startsAt: optionalDate(data.startsAt),
        endsAt: optionalDate(data.endsAt),
        maxRedemptions: data.maxRedemptions ?? null,
        minimumOrderCents: optionalCents(data.minimumOrderAmount)
      }
    })

    revalidatePath("/admin/discounts")
    return { ok: true, message: "Discount updated." }
  } catch (error) {
    return actionError(error, "Could not update discount.")
  }
}

export async function updateInventory(productId: string, _state: ActionState = initialActionState, formData?: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    if (!(formData instanceof FormData)) {
      throw new Error("Inventory form was not submitted correctly.")
    }

    const data = inventorySchema.parse({
      mode: formData.get("mode") || "ADD",
      quantity: formData.get("quantity"),
      lowStockThreshold: formData.get("lowStockThreshold") ?? "5"
    })
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } })
    const thresholdChanged = data.lowStockThreshold !== product.lowStockThreshold
    if (data.quantity === undefined && !thresholdChanged) {
      throw new Error("Enter a stock quantity or change the low stock threshold.")
    }

    const stockQuantity = data.quantity ?? 0
    const nextStock = data.quantity === undefined
      ? product.stock
      : data.mode === "SET"
        ? stockQuantity
        : product.stock + stockQuantity
    if (nextStock < 0) {
      throw new Error("Stock cannot become negative.")
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        stock: nextStock,
        lowStockThreshold: data.lowStockThreshold
      }
    })

    if (data.quantity !== undefined && nextStock > product.stock) {
      await createOperationalEvent({
        type: "inventory_restocked",
        message: `${updated.name} restocked (+${Number((nextStock - product.stock).toFixed(2))})`,
        metadata: { productId, previousStock: product.stock, stock: nextStock }
      })
    }

    if (nextStock <= 0 && product.stock > 0) {
      await createOperationalEvent({
        type: "product_sold_out",
        message: `${updated.name} marked sold out`,
        metadata: { productId, productName: updated.name }
      })
    } else if (nextStock > 0 && nextStock <= data.lowStockThreshold) {
      await createOperationalEvent({
        type: "low_stock_detected",
        message: `Low stock detected: ${updated.name}`,
        metadata: { productId, productName: updated.name, stock: nextStock }
      })
    }

    revalidatePath("/admin")
    revalidatePath("/admin/inventory")
    revalidatePath("/admin/products")
    return { ok: true, message: "Stock updated successfully." }
  } catch (error) {
    return actionError(error, "Could not update inventory.")
  }
}

export async function updateOrderStatus(orderId: string, _state: ActionState = initialActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin()
    const status = z.string().parse(formData.get("status"))
    if (!isFulfillmentStatus(status) || !adminOrderStatuses.includes(status)) {
      throw new Error("That order status cannot be selected from the admin dashboard.")
    }

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true }
    })

    if (order.status === status) {
      return { ok: true, message: "Order status is already up to date." }
    }

    assertValidOrderTransition(order.status, status, order.paymentStatus)

    await prisma.$transaction(async (tx) => {
      if ((status === "CANCELLED" || status === "REFUNDED") && order.stockReduced) {
        const releaseClaim = await tx.order.updateMany({
          where: { id: orderId, stockReduced: true },
          data: { stockReduced: false }
        })

        if (releaseClaim.count > 0) {
          for (const item of order.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } }
            })
          }
        }
      }

      if (status === "REFUNDED") {
        await tx.$executeRaw`
          UPDATE "Order"
          SET
            "status" = 'REFUNDED'::"OrderStatus",
            "paymentStatus" = 'REFUNDED'::"PaymentStatus",
            "updatedAt" = NOW()
          WHERE "id" = ${orderId}
        `
      } else if (status === "DELIVERED") {
        await tx.$executeRaw`
          UPDATE "Order"
          SET
            "status" = 'DELIVERED'::"OrderStatus",
            "deliveredAt" = COALESCE("deliveredAt", NOW()),
            "updatedAt" = NOW()
          WHERE "id" = ${orderId}
        `
      } else {
        await tx.$executeRaw`
          UPDATE "Order"
          SET
            "status" = ${status}::"OrderStatus",
            "updatedAt" = NOW()
          WHERE "id" = ${orderId}
        `
      }
    })

    await createOperationalEvent({
      type: status === "REFUNDED" ? "refund_processed" : "order_status_updated",
      message: status === "REFUNDED" ? `Refund processed for order ${order.id}` : `Order status updated to ${status.replaceAll("_", " ").toLowerCase()}`,
      metadata: { orderId: order.id, status }
    })
    await notifyOrderStatusChanged(order.id, order.status, status)
    revalidatePath("/admin/orders")
    revalidatePath("/admin")
    return { ok: true, message: "Order status updated." }
  } catch (error) {
    return actionError(error, "Could not update order.")
  }
}

function revalidateAdmin() {
  revalidatePath("/")
  revalidatePath("/products")
  revalidatePath("/admin/products")
  revalidatePath("/admin/categories")
}

function actionError(error: unknown, fallback: string): ActionState {
  if (error instanceof z.ZodError) {
    const message = error.issues.map((issue) => issue.message).filter(Boolean).join(" ")
    return { ok: false, message: message || "Please check the form fields." }
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { ok: false, message: "A record with that unique value already exists." }
  }

  if (error instanceof Error) {
    return { ok: false, message: error.message || fallback }
  }

  return { ok: false, message: fallback }
}
