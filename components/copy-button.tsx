"use client"

import { useState } from "react"

import { copyText } from "@/lib/clipboard"

export function CopyButton({ label = "Copy", value }: { label?: string; value: string }) {
  const [copied, setCopied] = useState(false)

  async function copyValue() {
    try {
      await copyText(value)
      setCopied(true)
      window.dispatchEvent(new CustomEvent("freshcart-toast", { detail: { message: "Copied" } }))
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
      window.dispatchEvent(new CustomEvent("freshcart-toast", { detail: { message: "Could not copy. Please copy manually.", ok: false } }))
    }
  }

  return (
    <button className="copy-button" onClick={copyValue} type="button">
      {copied ? "Copied!" : label}
    </button>
  )
}
