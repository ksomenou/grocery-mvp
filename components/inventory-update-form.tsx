"use client"

import { useActionState, useState } from "react"

import { ActionToast } from "@/components/admin-ui"
import { updateInventory, type ActionState } from "@/lib/actions"

const emptyState: ActionState = { ok: false, message: "" }

export function InventoryUpdateForm({
  currentThreshold,
  productId
}: {
  currentThreshold: number
  productId: string
}) {
  const [state, formAction] = useActionState(updateInventory.bind(null, productId), emptyState)
  const [mode, setMode] = useState<"ADD" | "SET">("ADD")
  const [quantity, setQuantity] = useState("")
  const [threshold, setThreshold] = useState(String(currentThreshold))

  const quantityValue = Number(quantity)
  const thresholdValue = Number(threshold)
  const quantityIsBlank = quantity.trim().length === 0
  const quantityIsValid =
    !quantityIsBlank &&
    Number.isFinite(quantityValue) &&
    (mode === "SET" ? quantityValue >= 0 : quantityValue > 0)
  const thresholdIsValid = threshold.trim().length > 0 && Number.isFinite(thresholdValue) && thresholdValue >= 0
  const thresholdChanged = thresholdIsValid && thresholdValue !== currentThreshold
  const hasInvalidQuantity = !quantityIsBlank && !quantityIsValid
  const canSubmit = thresholdIsValid && !hasInvalidQuantity && (quantityIsValid || thresholdChanged)

  return (
    <>
      <ActionToast state={state} />
      <form action={formAction} className="inventory-update-form">
        <label className="form-field">
          <span>Update mode</span>
          <select className="select" name="mode" onChange={(event) => setMode(event.target.value as "ADD" | "SET")} value={mode}>
            <option value="ADD">Add stock</option>
            <option value="SET">Set exact stock</option>
          </select>
        </label>
        <label className="form-field">
          <span>Stock quantity</span>
          <input
            className="field"
            min={mode === "SET" ? "0" : "0.01"}
            name="quantity"
            onChange={(event) => setQuantity(event.target.value)}
            step="0.01"
            type="number"
            value={quantity}
          />
        </label>
        <label className="form-field">
          <span>Low stock threshold</span>
          <input
            className="field"
            min="0"
            name="lowStockThreshold"
            onChange={(event) => setThreshold(event.target.value)}
            required
            step="0.01"
            type="number"
            value={threshold}
          />
        </label>
        <button className="button secondary" disabled={!canSubmit} type="submit">
          Update stock
        </button>
      </form>
    </>
  )
}
