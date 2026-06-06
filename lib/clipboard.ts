"use client"

export async function copyText(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard is not available.")
  }

  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.setAttribute("readonly", "")
  textarea.style.left = "-9999px"
  textarea.style.position = "fixed"
  textarea.style.top = "0"

  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    const copied = document.execCommand("copy")
    if (!copied) {
      throw new Error("Copy command failed.")
    }
  } finally {
    textarea.remove()
  }
}
