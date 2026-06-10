"use server"

import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import type { ActionState } from "@/lib/actions"
import { requirePermission } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

const staffRoles = ["ORDER_STAFF", "INVENTORY_STAFF"] as const

const createStaffUserSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  name: z.string().trim().min(2, "Enter the staff member's name."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  role: z.enum(staffRoles, { errorMap: () => ({ message: "Choose a staff role." }) })
})

export async function createStaffUser(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requirePermission("admin-users:manage")
    const data = createStaffUserSchema.parse({
      email: formData.get("email"),
      name: formData.get("name"),
      password: formData.get("password"),
      role: formData.get("role")
    })

    const existing = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true }
    })
    if (existing) {
      return { ok: false, message: "A user with that email already exists." }
    }

    await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: await bcrypt.hash(data.password, 12),
        role: data.role
      }
    })

    revalidatePath("/admin/users")
    return { ok: true, message: "Staff user created." }
  } catch (error) {
    return actionError(error, "Could not create staff user.")
  }
}

export async function deactivateAdminUser(userId: string, _state: ActionState): Promise<ActionState> {
  try {
    const currentUser = await requirePermission("admin-users:manage")
    if (currentUser.id === userId) {
      return { ok: false, message: "You cannot deactivate your own account." }
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    })
    if (!target || target.role === "CUSTOMER") {
      return { ok: false, message: "Admin user was not found." }
    }

    if (target.role === "ADMIN") {
      const activeAdminCount = await prisma.user.count({
        where: { isActive: true, role: "ADMIN" }
      })
      if (activeAdminCount <= 1) {
        return { ok: false, message: "At least one active admin account is required." }
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false }
    })

    revalidatePath("/admin/users")
    return { ok: true, message: "Admin user deactivated." }
  } catch (error) {
    return actionError(error, "Could not deactivate user.")
  }
}

function actionError(error: unknown, fallback: string): ActionState {
  if (error instanceof z.ZodError) {
    const message = error.issues.map((issue) => issue.message).filter(Boolean).join(" ")
    return { ok: false, message: message || "Please check the form fields." }
  }

  if (error instanceof Error) {
    return { ok: false, message: error.message || fallback }
  }

  return { ok: false, message: fallback }
}
