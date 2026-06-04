"use client"

import { useEffect, useRef, useState } from "react"
import { useFormStatus } from "react-dom"

function formValidationReason(form: HTMLFormElement) {
  const data = new FormData(form)
  const code = String(data.get("code") ?? "").trim()
  const type = String(data.get("type") ?? "PERCENT")
  const scope = String(data.get("scope") ?? "ORDER")
  const productId = String(data.get("productId") ?? "").trim()
  const percent = Number(data.get("percentOff") ?? 0)
  const amount = Number(data.get("amountOff") ?? 0)
  const startsAt = String(data.get("startsAt") ?? "")
  const endsAt = String(data.get("endsAt") ?? "")

  if (!code) {
    return "Enter a discount code."
  }

  if (scope === "PRODUCT" && !productId) {
    return "Select a product for this discount."
  }

  if (type === "PERCENT" && (!Number.isFinite(percent) || percent < 1 || percent > 100)) {
    return "Enter a percent between 1 and 100."
  }

  if (type === "FIXED" && (!Number.isFinite(amount) || amount <= 0)) {
    return "Enter a fixed amount greater than 0."
  }

  if (startsAt && endsAt && new Date(endsAt) < new Date(startsAt)) {
    return "End date cannot be before start date."
  }

  return ""
}

function duplicateCode(form: HTMLFormElement, existingCodes: string[], currentCode?: string) {
  const data = new FormData(form)
  const code = String(data.get("code") ?? "").trim().toUpperCase()
  if (!code || code === currentCode?.toUpperCase()) {
    return ""
  }

  return existingCodes.includes(code) ? "Code already exists." : ""
}

export function DiscountFormSubmit({
  cancelHref,
  confirmMessage,
  currentCode,
  existingCodes = [],
  label,
  pendingLabel
}: {
  cancelHref?: string
  confirmMessage?: string
  currentCode?: string
  existingCodes?: string[]
  label: string
  pendingLabel: string
}) {
  const { pending } = useFormStatus()
  const [canSubmit, setCanSubmit] = useState(false)
  const [error, setError] = useState("")
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const form = buttonRef.current?.closest("form")
    if (!(form instanceof HTMLFormElement)) {
      return
    }

    const update = () => {
      const duplicate = duplicateCode(form, existingCodes, currentCode)
      const validation = formValidationReason(form)
      setError(duplicate || validation)
      setCanSubmit(!duplicate && !validation)
    }
    const cancelEditing = (event: KeyboardEvent) => {
      if (event.key === "Escape" && cancelHref) {
        event.preventDefault()
        window.location.href = cancelHref
      }
    }
    update()
    form.addEventListener("input", update)
    form.addEventListener("change", update)
    form.addEventListener("keydown", cancelEditing)
    document.addEventListener("freshcart-discount-change", update)
    return () => {
      form.removeEventListener("input", update)
      form.removeEventListener("change", update)
      form.removeEventListener("keydown", cancelEditing)
      document.removeEventListener("freshcart-discount-change", update)
    }
  }, [cancelHref, currentCode, existingCodes])

  return (
    <>
      {error ? <p className="field-error discount-submit-help">{error}</p> : null}
      <button
        className="button"
        disabled={pending || !canSubmit}
        onClick={(event) => {
          if (confirmMessage && !window.confirm(confirmMessage)) {
            event.preventDefault()
          }
        }}
        ref={buttonRef}
        type="submit"
      >
        {pending ? <><span className="button-spinner" aria-hidden="true" />{pendingLabel}</> : label}
      </button>
    </>
  )
}
