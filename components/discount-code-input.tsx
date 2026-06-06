"use client"

import { useRef, useState } from "react"

const marketingCodes = ["SAVE10", "FRESH5", "GROCERY20", "WEEKEND15", "FRESH25", "DEAL10", "MARKET15"]

export function DiscountCodeInput({ defaultValue = "" }: { defaultValue?: string }) {
  const [code, setCode] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement | null>(null)

  function generateCode() {
    const nextCode = marketingCodes[Math.floor(Math.random() * marketingCodes.length)]
    setCode(nextCode)
    window.setTimeout(() => {
      inputRef.current?.dispatchEvent(new Event("input", { bubbles: true }))
      document.dispatchEvent(new Event("freshcart-discount-change", { bubbles: true }))
    }, 0)
  }

  function changeCode(value: string) {
    setCode(value.toUpperCase())
    window.setTimeout(() => {
      document.dispatchEvent(new Event("freshcart-discount-change", { bubbles: true }))
    }, 0)
  }

  return (
    <label className="form-field">
      <span>Code</span>
      <div className="discount-code-input">
        <input
          className="field"
          name="code"
          onChange={(event) => changeCode(event.target.value)}
          placeholder="FRESH10"
          ref={inputRef}
          required
          value={code}
        />
        <button className="copy-button" onClick={generateCode} type="button">Generate</button>
      </div>
    </label>
  )
}
