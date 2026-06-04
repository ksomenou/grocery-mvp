import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const r2PublicUrl = process.env.R2_PUBLIC_URL
let r2ImagePattern

if (r2PublicUrl) {
  try {
    const url = new URL(r2PublicUrl)
    r2ImagePattern = {
      hostname: url.hostname,
      pathname: "/**",
      protocol: url.protocol.replace(":", "")
    }
  } catch {
    r2ImagePattern = undefined
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "192.168.1.169"],
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb"
    }
  },
  images: {
    remotePatterns: [
      ...(r2ImagePattern ? [r2ImagePattern] : [])
    ]
  },
  turbopack: {
    root: __dirname
  }
}

export default nextConfig
