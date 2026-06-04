"use server"

import { loginUser, logoutUser, requireAdmin as requireAdminUser } from "@/lib/auth"

export async function loginAdmin(formData: FormData) {
  return loginUser(formData)
}

export async function logoutAdmin() {
  return logoutUser()
}

export async function requireAdmin() {
  return requireAdminUser()
}
