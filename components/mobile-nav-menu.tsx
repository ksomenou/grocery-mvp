"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

type MobileNavMenuProps = {
  logoutAction: () => Promise<void>
  userRole: "ADMIN" | "CUSTOMER" | null
}

const guestLinks = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/login", label: "Login" },
  { href: "/register", label: "Register" },
  { href: "/cart", label: "Cart" }
]

const customerLinks = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/account", label: "Account" },
  { href: "/account/orders", label: "Order history" },
  { href: "/cart", label: "Cart" }
]

const adminLinks = [
  { href: "/admin", label: "Admin Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" }
]

const categoryLinks = [
  { href: `/products?category=${encodeURIComponent("Fruits")}`, label: "Fruits" },
  { href: `/products?category=${encodeURIComponent("Vegetables")}`, label: "Vegetables" },
  { href: `/products?category=${encodeURIComponent("Meat")}`, label: "Meat" },
  { href: `/products?category=${encodeURIComponent("Seafood")}`, label: "Seafood" },
  { href: `/products?category=${encodeURIComponent("African Foods")}`, label: "African Foods" },
  { href: `/products?category=${encodeURIComponent("Caribbean Foods")}`, label: "Caribbean Foods" }
]

export function MobileNavMenu({ logoutAction, userRole }: MobileNavMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const mainLinks = userRole === "ADMIN" ? adminLinks : userRole === "CUSTOMER" ? customerLinks : guestLinks

  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", isOpen)
    return () => document.body.classList.remove("mobile-menu-open")
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [isOpen])

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-label="Open menu"
        className="mobile-menu-toggle"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <span />
        <span />
        <span />
      </button>
      <div className={`mobile-menu-shell ${isOpen ? "open" : ""}`} aria-hidden={!isOpen}>
        <button className={`mobile-menu-backdrop ${isOpen ? "open" : ""}`} onClick={() => setIsOpen(false)} type="button" />
        <aside className="mobile-menu-panel" aria-label="Mobile navigation" role="dialog" aria-modal="true">
          <div className="mobile-menu-head">
            <div>
              <p>Menu</p>
              <strong>Shop groceries</strong>
            </div>
            <button aria-label="Close menu" className="icon-button" onClick={() => setIsOpen(false)} type="button">
              X
            </button>
          </div>
          <nav className="mobile-menu-links" aria-label="Mobile menu links">
            {mainLinks.map((link) => (
              <Link href={link.href} key={link.href} onClick={() => setIsOpen(false)}>
                {link.label}
              </Link>
            ))}
            {userRole ? (
              <form action={logoutAction}>
                <button type="submit">Log out</button>
              </form>
            ) : null}
          </nav>
          <div className="mobile-menu-categories">
            <p>Quick categories</p>
            <div>
              {categoryLinks.map((link) => (
                <Link href={link.href} key={link.href} onClick={() => setIsOpen(false)}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}
