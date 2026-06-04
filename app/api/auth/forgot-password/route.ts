import { randomBytes } from "node:crypto"

import { NextResponse } from "next/server"
import { z } from "zod"

import { logError, logInfo } from "@/lib/log"
import { prisma } from "@/lib/prisma"
import { storeName } from "@/lib/store"

const forgotPasswordSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase())
})

const genericMessage = "If an account exists, we’ll send a reset link."

function providerConfigured(value?: string) {
  return Boolean(value && value.trim() && !value.includes("replace_me"))
}

async function sendResetEmail(email: string, token: string) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  console.log("RESEND_API_KEY loaded:", Boolean(apiKey))
  console.log("EMAIL_FROM:", from)

  if (!providerConfigured(apiKey) || !providerConfigured(from)) {
    logInfo("Password reset email skipped because email provider is not configured.", { email })
    return
  }

  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Reset your F & A International Grocery password",
      text: [
        `Reset your ${storeName} password`,
        "",
        "Use this link within 30 minutes:",
        resetUrl,
        "",
        "If you did not request this, you can ignore this email."
      ].join("\n")
    })
  })

  if (!response.ok) {
    const responseBody = await response.text()
    console.error("[resend password reset status]", response.status)
    console.error("[resend password reset body]", responseBody)
    throw new Error(`Resend password reset email failed with status ${response.status}.`)
  }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
  }

  const parsed = forgotPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { email: true }
  })

  if (user) {
    const token = randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

    await prisma.passwordResetToken.create({
      data: {
        email: user.email,
        expiresAt,
        token
      }
    })

    try {
      await sendResetEmail(user.email, token)
    } catch (error) {
      logError("Password reset email failed.", error, { email: user.email })
    }
  }

  return NextResponse.json({ message: genericMessage })
}
