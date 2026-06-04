import { NextResponse } from "next/server"

import { requireAdmin } from "@/lib/admin-auth"
import { uploadProductImageToR2 } from "@/lib/r2"

export async function POST(request: Request) {
  try {
    await requireAdmin()

    const formData = await request.formData()
    const file = formData.get("image")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a product image to upload." }, { status: 400 })
    }

    const uploaded = await uploadProductImageToR2(file)

    return NextResponse.json(uploaded)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not upload product image."
    console.error("[product image upload]", message)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
