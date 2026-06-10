import Link from "next/link"

import { AdminLogoutForm } from "@/components/admin-logout-form"
import { logoutAdmin } from "@/lib/admin-auth"
import { getCurrentUser } from "@/lib/auth"
import { hasPermission } from "@/lib/permissions"

export async function AdminNav({
  active,
  lowStockCount = 0,
  pendingOrderCount = 0
}: {
  active: "dashboard" | "products" | "categories" | "orders" | "inventory" | "discounts" | "users"
  lowStockCount?: number
  pendingOrderCount?: number
}) {
  const user = await getCurrentUser()
  const links = [
    ["dashboard", "/admin", "Dashboard", "dashboard"],
    ["products", "/admin/products", "Products", "products:view"],
    ["orders", "/admin/orders", "Orders", "orders:view"],
    ["inventory", "/admin/inventory", "Inventory", "inventory:update"],
    ["categories", "/admin/categories", "Categories", "categories:manage"],
    ["discounts", "/admin/discounts", "Discounts", "discounts:manage"],
    ["users", "/admin/users", "Admin users", "admin-users:manage"]
  ] as const
  const visibleLinks = links.filter(([, , , permission]) => hasPermission(user?.role, permission))

  return (
    <div className="admin-topbar">
      <span className="admin-nav-label">Admin sections</span>
      <nav className="admin-tabs" aria-label="Admin navigation">
        {visibleLinks.map(([key, href, label]) => {
          const badgeCount = key === "orders" ? pendingOrderCount : key === "products" ? lowStockCount : 0
          return (
          <Link className={active === key ? "active" : ""} href={href} key={key} prefetch={false}>
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
