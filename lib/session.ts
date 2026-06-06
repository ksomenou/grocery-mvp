const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const sessionCookie = "freshcart_session"

export type SessionPayload = {
  email: string
  id: string
  name: string
  role: "CUSTOMER" | "ADMIN"
}

function authSecret() {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? process.env.ADMIN_SESSION_SECRET
}

function base64UrlEncode(value: Uint8Array) {
  let binary = ""
  value.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
}

function base64UrlDecode(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/")
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
  const binary = atob(padded)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export async function signSessionValue(value: string) {
  const secret = authSecret()
  if (!secret) {
    throw new Error("AUTH_SECRET is required for authentication.")
  }

  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { hash: "SHA-256", name: "HMAC" }, false, ["sign"])
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value))
  return base64UrlEncode(new Uint8Array(signature))
}

export function encodeSessionPayload(payload: SessionPayload) {
  return base64UrlEncode(encoder.encode(JSON.stringify(payload)))
}

export function decodeSessionPayload(value: string): SessionPayload | null {
  try {
    return JSON.parse(decoder.decode(base64UrlDecode(value))) as SessionPayload
  } catch {
    return null
  }
}

export async function verifySessionCookie(value?: string) {
  if (!value || !value.includes(".")) {
    return null
  }

  const [payload, signature] = value.split(".")
  if (!payload || !signature || signature !== await signSessionValue(payload)) {
    return null
  }

  return decodeSessionPayload(payload)
}
