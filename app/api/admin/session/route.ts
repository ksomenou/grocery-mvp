import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { isAdminRole } from "@/lib/permissions"

export async function GET() {
  try {
    const user = await getCurrentUser()
    return NextResponse.json({ isAdmin: isAdminRole(user?.role), role: user?.role ?? null })
  } catch {
    return NextResponse.json({ isAdmin: false, role: null })
  }
}
