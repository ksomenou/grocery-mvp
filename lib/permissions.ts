export const adminRoles = ["ADMIN", "ORDER_STAFF", "INVENTORY_STAFF"] as const

export type AdminRole = (typeof adminRoles)[number]

export type AdminPermission =
  | "dashboard"
  | "products:view"
  | "products:manage"
  | "inventory:update"
  | "orders:view"
  | "orders:update"
  | "categories:manage"
  | "discounts:manage"
  | "refunds:create"
  | "admin-users:manage"

const rolePermissions: Record<AdminRole, AdminPermission[]> = {
  ADMIN: [
    "dashboard",
    "products:view",
    "products:manage",
    "inventory:update",
    "orders:view",
    "orders:update",
    "categories:manage",
    "discounts:manage",
    "refunds:create",
    "admin-users:manage"
  ],
  ORDER_STAFF: ["orders:view", "orders:update", "refunds:create"],
  INVENTORY_STAFF: ["products:view", "inventory:update"]
}

export function isAdminRole(role?: string | null): role is AdminRole {
  return Boolean(role && adminRoles.includes(role as AdminRole))
}

export function hasPermission(role: string | null | undefined, permission: AdminPermission) {
  return isAdminRole(role) && rolePermissions[role].includes(permission)
}

export function adminLandingPath(role: string) {
  if (role === "ORDER_STAFF") {
    return "/admin/orders"
  }

  if (role === "INVENTORY_STAFF") {
    return "/admin/inventory"
  }

  return "/admin"
}

export function permissionForAdminPath(pathname: string): AdminPermission {
  if (pathname === "/admin") {
    return "dashboard"
  }

  if (pathname.startsWith("/admin/orders")) {
    return "orders:view"
  }

  if (pathname.startsWith("/admin/products")) {
    return "products:view"
  }

  if (pathname.startsWith("/admin/inventory")) {
    return "inventory:update"
  }

  if (pathname.startsWith("/admin/categories")) {
    return "categories:manage"
  }

  if (pathname.startsWith("/admin/discounts")) {
    return "discounts:manage"
  }

  if (pathname.startsWith("/admin/users")) {
    return "admin-users:manage"
  }

  return "dashboard"
}

export function canAccessAdminPath(role: string | null | undefined, pathname: string) {
  return hasPermission(role, permissionForAdminPath(pathname))
}

export function loginRedirectDestination(role: string, next?: string | null) {
  if (!isAdminRole(role)) {
    return "/"
  }

  const normalizedNext = next?.startsWith("/admin") ? next : null
  if (normalizedNext && canAccessAdminPath(role, normalizedNext)) {
    return normalizedNext
  }

  return adminLandingPath(role)
}
