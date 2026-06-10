"use server"

import bcrypt from "bcryptjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"

import { hasPermission, isAdminRole, loginRedirectDestination, type AdminPermission } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { encodeSessionPayload, sessionCookie, signSessionValue, verifySessionCookie, type SessionPayload } from "@/lib/session"

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name."),
  email: z.string().trim().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters.")
})

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Enter your password.")
})

const adminSetupSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string().min(8, "Confirm your password.")
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"]
})

async function createSession(user: SessionPayload) {
  const payload = encodeSessionPayload(user)
  const signature = await signSessionValue(payload)
  const cookieStore = await cookies()
  cookieStore.set(sessionCookie, `${payload}.${signature}`, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 14,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  })
}

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const session = await verifySessionCookie(cookieStore.get(sessionCookie)?.value)
  if (!session) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { email: true, id: true, isActive: true, name: true, role: true }
  })

  if (!user?.isActive) {
    return null
  }

  return user
}

export async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || !isAdminRole(user.role)) {
    throw new Error("You do not have permission to access this page.")
  }

  return user
}

export async function requirePermission(permission: AdminPermission) {
  const user = await requireAdmin()
  if (!hasPermission(user.role, permission)) {
    throw new Error("You do not have permission to perform this action.")
  }

  return user
}

export async function loginUser(formData: FormData) {
  const next = String(formData.get("next") ?? "")
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  })

  if (!parsed.success) {
    redirect("/login?error=invalid")
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  const valid = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false
  if (!user || !valid || !user.isActive) {
    redirect("/login?error=invalid")
  }

  await createSession({ email: user.email, id: user.id, name: user.name, role: user.role })
  if (isAdminRole(user.role)) {
    const destination = loginRedirectDestination(user.role, next)
    console.info("[login redirect]", { destination, next, role: user.role })
    redirect(destination)
  }

  console.info("[login redirect]", { destination: next && !next.startsWith("/admin") ? next : "/", next, role: user.role })
  redirect(next && !next.startsWith("/admin") ? next : "/")
}

export async function hasAdminUser() {
  const count = await prisma.user.count({ where: { role: "ADMIN" } })
  return count > 0
}

export async function setupFirstAdmin(formData: FormData) {
  const parsed = adminSetupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword")
  })

  if (!parsed.success) {
    redirect("/admin/setup?error=invalid")
  }

  if (await hasAdminUser()) {
    redirect("/login")
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    redirect("/admin/setup?error=duplicate")
  }

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: "Store Admin",
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      role: "ADMIN"
    }
  })

  await createSession({ email: user.email, id: user.id, name: user.name, role: user.role })
  redirect("/admin")
}

export async function registerUser(formData: FormData) {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password")
  })

  if (!parsed.success) {
    redirect("/register?error=invalid")
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) {
    redirect("/register?error=duplicate")
  }

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      role: "CUSTOMER"
    }
  })

  await createSession({ email: user.email, id: user.id, name: user.name, role: user.role })
  redirect("/")
}

export async function logoutUser() {
  const cookieStore = await cookies()
  cookieStore.delete(sessionCookie)
  redirect("/login")
}
