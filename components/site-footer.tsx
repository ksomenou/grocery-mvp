"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { businessHours } from "@/lib/business-hours"
import { storeName } from "@/lib/store"

export function SiteFooter() {
  const pathname = usePathname()

  if (pathname.startsWith("/admin")) {
    return null
  }

  return (
    <>
      <div className="shell footer-trust-strip" aria-label="Store trust details">
        <span>Fresh groceries</span>
        <span>Local delivery</span>
        <span>Secure checkout</span>
        <span>Pickup available</span>
      </div>
      <footer className="site-footer">
        <div className="shell footer-inner">
          <div className="footer-brand">
            <span className="brand-mark logo-mark">
              <Image alt="" height={40} src="/logo.png" width={40} />
            </span>
            <div>
              <strong>{storeName}</strong>
              <p>&copy; 2026 {storeName}</p>
            </div>
          </div>
          <div className="footer-hours" aria-label="Business hours">
            <strong>Business hours</strong>
            {businessHours.map((item) => (
              <p key={item.label}>
                <span>{item.label}</span>
                <span>{item.hours}</span>
              </p>
            ))}
          </div>
          <nav className="footer-links" aria-label="Footer navigation">
            <Link href="/about">About</Link>
            <Link href="/refund-policy">Refund Policy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/support">Support</Link>
          </nav>
        </div>
      </footer>
    </>
  )
}
