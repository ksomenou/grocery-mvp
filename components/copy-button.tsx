"use client"

import { useState } from "react"

export function CopyButton({ label = "Copy", value }: { label?: string; value: string }) {
  const [copied, setCopied] = useState(false)

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.dispatchEvent(new CustomEvent("freshcart-toast", { detail: { message: "Code copied" } }))
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button className="copy-button" onClick={copyValue} type="button">
      {copied ? "Copied!" : label}
    </button>
  )
}
