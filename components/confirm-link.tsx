"use client"

import Link from "next/link"
import type { ReactNode } from "react"

export function ConfirmLink({
  children,
  className,
  href,
  message
}: {
  children: ReactNode
  className?: string
  href: string
  message?: string
}) {
  return (
    <Link
      className={className}
      href={href}
      onClick={(event) => {
        if (message && !window.confirm(message)) {
          event.preventDefault()
        }
      }}
      prefetch={href.startsWith("/admin") ? false : undefined}
    >
      {children}
    </Link>
  )
}
