import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"

export async function GET() {
  try {
    const user = await getCurrentUser()
    return NextResponse.json({ isAdmin: user?.role === "ADMIN" })
  } catch {
    return NextResponse.json({ isAdmin: false })
  }
}
