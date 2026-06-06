"use client"

import { useState } from "react"
import type { ReactNode } from "react"

export function MobileOrderFilters({
  activeCount,
  children
}: {
  activeCount: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`mobile-order-filters ${open ? "open" : ""}`}>
      <button
        aria-expanded={open}
        className="button secondary mobile-order-filter-toggle"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        Filters{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>
      <div className="mobile-order-filter-panel">{children}</div>
    </div>
  )
}
