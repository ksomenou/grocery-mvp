import Link from "next/link"

import { AdminLogoutForm } from "@/components/admin-logout-form"
import { logoutAdmin } from "@/lib/admin-auth"

export function AdminNav({
  active,
  lowStockCount = 0,
  pendingOrderCount = 0
}: {
  active: "dashboard" | "products" | "categories" | "orders"
  lowStockCount?: number
  pendingOrderCount?: number
}) {
  const links = [
    ["dashboard", "/admin", "Dashboard"],
    ["products", "/admin/products", "Products"],
    ["orders", "/admin/orders", "Orders"]
  ] as const

  return (
    <div className="admin-topbar">
      <span className="admin-nav-label">Admin sections</span>
      <nav className="admin-tabs" aria-label="Admin navigation">
        {links.map(([key, href, label]) => {
          const badgeCount = key === "orders" ? pendingOrderCount : key === "products" ? lowStockCount : 0
          return (
          <Link className={active === key ? "active" : ""} href={href} key={key}>
            {label}
            {badgeCount > 0 ? <span className="admin-tab-badge">{badgeCount}</span> : null}
          </Link>
          )
        })}
      </nav>
      <AdminLogoutForm action={logoutAdmin} />
    </div>
  )
}
