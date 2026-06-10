import { NextResponse, type NextRequest } from "next/server"

import { adminLandingPath, canAccessAdminPath, isAdminRole } from "@/lib/permissions"
import { sessionCookie, verifySessionCookie } from "@/lib/session"

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login" || request.nextUrl.pathname === "/admin/setup") {
    return NextResponse.next()
  }

  const session = await verifySessionCookie(request.cookies.get(sessionCookie)?.value)
  if (isAdminRole(session?.role) && canAccessAdminPath(session?.role, request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  if (isAdminRole(session?.role)) {
    const destination = adminLandingPath(session.role)
    console.info("[admin proxy redirect]", {
      destination,
      next: request.nextUrl.pathname,
      role: session.role
    })
    return NextResponse.redirect(new URL(destination, request.url))
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = "/login"
  loginUrl.searchParams.set("next", request.nextUrl.pathname)
  console.info("[admin proxy login redirect]", {
    destination: loginUrl.pathname,
    next: request.nextUrl.pathname,
    role: session?.role ?? null
  })
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/admin/:path*"]
}
