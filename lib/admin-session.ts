const encoder = new TextEncoder()

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export async function adminCookieValue() {
  const password = process.env.ADMIN_PASSWORD
  if (!password) {
    return "freshcart-dev-admin"
  }

  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.AUTH_SECRET ?? password
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`${password}:${secret}`))
  return bytesToHex(digest)
}
