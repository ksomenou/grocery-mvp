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
import { storeName } from "@/lib/store"

import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: storeName,
    template: `%s | ${storeName}`
  },
  description: `Shop fresh groceries for local delivery or pickup with ${storeName}.`,
  applicationName: storeName,
  icons: {
    icon: "/icon.svg"
  },
  openGraph: {
    title: storeName,
    description: "Fresh groceries for local delivery or pickup.",
    siteName: storeName,
    type: "website"
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser()

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
                  {user.role === "ADMIN" ? <Link href="/admin">Admin</Link> : <Link href="/account">Account</Link>}
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
              <MobileNavMenu />
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
