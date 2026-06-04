import { NextResponse, type NextRequest } from "next/server"

import { sessionCookie, verifySessionCookie } from "@/lib/session"

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next()
  }

  const session = await verifySessionCookie(request.cookies.get(sessionCookie)?.value)
  if (session?.role === "ADMIN") {
    return NextResponse.next()
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = "/login"
  loginUrl.searchParams.set("next", request.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/admin/:path*"]
}
