"use server"

import {
  loginUser,
  logoutUser,
  requireAdmin as requireAdminUser,
  requirePermission as requirePermissionUser
} from "@/lib/auth"
import type { AdminPermission } from "@/lib/permissions"

export async function loginAdmin(formData: FormData) {
  return loginUser(formData)
}

export async function logoutAdmin() {
  return logoutUser()
}

export async function requireAdmin() {
  return requireAdminUser()
}

export async function requirePermission(permission: AdminPermission) {
  return requirePermissionUser(permission)
}
