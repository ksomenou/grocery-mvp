"use client"

import { useEffect } from "react"

export function ScrollIntoView({ selector }: { selector: string }) {
  useEffect(() => {
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [selector])

  return null
}
