import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { randomBytes } from "node:crypto"

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"])
const maxImageBytes = 8 * 1024 * 1024

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is not configured.`)
  }

  return value
}

function r2Client() {
  const accountId = requiredEnv("R2_ACCOUNT_ID")

  return new S3Client({
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY")
    },
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: "auto"
  })
}

function safeExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "")
  if (extension) {
    return extension
  }

  if (file.type === "image/jpeg") return "jpg"
  if (file.type === "image/png") return "png"
  if (file.type === "image/webp") return "webp"
  if (file.type === "image/gif") return "gif"
  if (file.type === "image/svg+xml") return "svg"

  return "img"
}

export async function uploadProductImageToR2(file: File) {
  if (!allowedImageTypes.has(file.type)) {
    throw new Error("Upload a JPG, PNG, WebP, GIF, or SVG image.")
  }

  if (file.size <= 0) {
    throw new Error("Choose an image file to upload.")
  }

  if (file.size > maxImageBytes) {
    throw new Error("Product image must be 8MB or smaller.")
  }

  const bucket = requiredEnv("R2_BUCKET_NAME")
  const publicUrl = requiredEnv("R2_PUBLIC_URL").replace(/\/+$/, "")
  const key = `products/${Date.now()}-${randomBytes(8).toString("hex")}.${safeExtension(file)}`
  const body = Buffer.from(await file.arrayBuffer())

  await r2Client().send(new PutObjectCommand({
    Body: body,
    Bucket: bucket,
    CacheControl: "public, max-age=31536000, immutable",
    ContentType: file.type,
    Key: key
  }))

  return {
    key,
    url: `${publicUrl}/${key}`
  }
}
