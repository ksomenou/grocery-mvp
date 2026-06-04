import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { z } from "zod"

import { logError } from "@/lib/log"
import { prisma } from "@/lib/prisma"

const resetPasswordSchema = z.object({
  token: z.string().trim().min(32),
  password: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string().min(8)
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"]
})

const invalidResetMessage = "Reset link is invalid or expired."

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: invalidResetMessage }, { status: 400 })
  }

  const parsed = resetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    const error = firstIssue?.path[0] === "password" || firstIssue?.path[0] === "confirmPassword"
      ? firstIssue.message
      : invalidResetMessage
    return NextResponse.json({ error }, { status: 400 })
  }

  try {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: parsed.data.token }
    })

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      return NextResponse.json({ error: invalidResetMessage }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: resetToken.email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ error: invalidResetMessage }, { status: 400 })
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) }
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() }
      }),
      prisma.passwordResetToken.updateMany({
        where: {
          email: resetToken.email,
          id: { not: resetToken.id },
          usedAt: null
        },
        data: { usedAt: new Date() }
      })
    ])

    return NextResponse.json({ redirectTo: "/login?reset=success" })
  } catch (error) {
    logError("Password reset failed.", error)
    return NextResponse.json({ error: "Password reset is unavailable right now. Please try again." }, { status: 500 })
  }
}
