"use server"

import bcrypt from "bcryptjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"

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

function envAdminCredentials() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim()
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    return null
  }

  return { email, password }
}

function isEnvAdminSession(session: SessionPayload) {
  const admin = envAdminCredentials()
  return Boolean(admin && session.role === "ADMIN" && session.email.toLowerCase().trim() === admin.email)
}

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const session = await verifySessionCookie(cookieStore.get(sessionCookie)?.value)
  if (!session) {
    return null
  }

  if (isEnvAdminSession(session)) {
    return session
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { email: true, id: true, name: true, role: true }
  })

  return user
}

export async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== "ADMIN") {
    throw new Error("Admin access is required.")
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

  const admin = envAdminCredentials()
  if (admin && parsed.data.email === admin.email && parsed.data.password === admin.password) {
    await createSession({
      email: admin.email,
      id: "env-admin",
      name: "Store Admin",
      role: "ADMIN"
    })
    redirect(next.startsWith("/admin") ? next : "/admin")
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  const valid = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false
  if (!user || !valid) {
    redirect("/login?error=invalid")
  }

  await createSession({ email: user.email, id: user.id, name: user.name, role: user.role })
  if (user.role === "ADMIN") {
    redirect(next.startsWith("/admin") ? next : "/admin")
  }

  redirect(next && !next.startsWith("/admin") ? next : "/")
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
