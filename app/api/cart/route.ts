import { NextResponse } from "next/server"
import { z } from "zod"

import { prisma } from "@/lib/prisma"

const cartItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  priceCents: z.number().int().nonnegative(),
  originalPriceCents: z.number().int().nonnegative().optional(),
  discountBadge: z.string().optional(),
  imageUrl: z.string(),
  stock: z.number().finite().nonnegative(),
  saleUnit: z.enum(["EACH", "LB"]),
  taxable: z.boolean().default(false),
  quantity: z.number().finite().positive()
})

const saveCartSchema = z.object({
  email: z.string().email(),
  items: z.array(cartItemSchema)
})

export async function GET(request: Request) {
  const url = new URL(request.url)
  const email = url.searchParams.get("email")?.trim().toLowerCase()

  if (!email) {
    return NextResponse.json({ items: [] })
  }

  const cart = await prisma.savedCart.findUnique({ where: { email } })
  return NextResponse.json({ items: cart?.items ?? [] })
}

export async function POST(request: Request) {
  const parsed = saveCartSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter an email and valid cart items." }, { status: 400 })
  }

  const email = parsed.data.email.toLowerCase()
  await prisma.savedCart.upsert({
    where: { email },
    update: { items: parsed.data.items },
    create: { email, items: parsed.data.items }
  })

  return NextResponse.json({ ok: true })
}
