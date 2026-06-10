import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Suspense } from "react"
import type { ReactNode } from "react"

import { AppToasts } from "@/components/app-toasts"
import { CartBadge } from "@/components/cart-badge"
import { CartDrawer } from "@/components/cart-drawer"
import { DeliveryZipSelector } from "@/components/delivery-zip-selector"
import { MobileNavMenu } from "@/components/mobile-nav-menu"
import { SearchBox } from "@/components/search-box"
import { SiteFooter } from "@/components/site-footer"
import { StickyCartButton } from "@/components/sticky-cart-button"
import { getCurrentUser, logoutUser } from "@/lib/auth"
import { isAdminRole } from "@/lib/permissions"
import { storeName } from "@/lib/store"

import "./globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://fainternationalgrocery.com"),
  title: {
    default: storeName,
    template: `%s | ${storeName}`
  },
  description: `Shop fresh groceries for local delivery or pickup with ${storeName}.`,
  applicationName: storeName,
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png"
  },
  openGraph: {
    title: storeName,
    description: "Fresh groceries for local delivery or pickup.",
    images: [
      {
        url: "/opengraph-image.png",
        alt: `${storeName} logo`
      }
    ],
    siteName: storeName,
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: storeName,
    description: "Fresh groceries for local delivery or pickup.",
    images: ["/opengraph-image.png"]
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser()
  const adminHref = user?.role === "ORDER_STAFF" ? "/admin/orders" : user?.role === "INVENTORY_STAFF" ? "/admin/inventory" : "/admin"
  const adminLabel = user?.role === "ORDER_STAFF" ? "Orders" : user?.role === "INVENTORY_STAFF" ? "Inventory" : "Admin"

  return (
    <html lang="en">
      <body>
        <header className="nav">
          <div className="shell nav-inner">
            <Link className="brand" href="/">
              <span className="brand-mark logo-mark">
                <Image alt="" height={40} priority src="/logo.png" width={40} />
              </span>
              <span className="brand-name">{storeName}</span>
            </Link>
            <div className="nav-search">
              <Suspense fallback={<div className="nav-search-fallback" />}>
                <SearchBox />
              </Suspense>
            </div>
            <DeliveryZipSelector />
            <nav className="nav-links" aria-label="Main navigation">
              <Link href="/">Home</Link>
              <Link href="/products">Products</Link>
              {user ? (
                <>
                  {isAdminRole(user.role) ? <Link href={adminHref} prefetch={false}>{adminLabel}</Link> : <Link href="/account">Account</Link>}
                  <form action={logoutUser}>
                    <button type="submit">Logout</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login">Login</Link>
                  <Link href="/register">Register</Link>
                </>
              )}
            </nav>
            <div className="nav-actions">
              <MobileNavMenu logoutAction={logoutUser} userRole={user?.role ?? null} />
              <CartBadge />
            </div>
          </div>
        </header>
        {children}
        <SiteFooter />
        <CartDrawer />
        <StickyCartButton />
        <AppToasts />
      </body>
    </html>
  )
}
