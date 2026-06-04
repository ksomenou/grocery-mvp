"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useFormStatus } from "react-dom"

import type { ActionState } from "@/lib/actions"
import { formatQuantity } from "@/lib/format"

const emptyState: ActionState = { ok: false, message: "" }

export function ActionToast({ state }: { state: ActionState }) {
  useEffect(() => {
    if (state.message) {
      window.dispatchEvent(new CustomEvent("freshcart-toast", { detail: { message: state.message } }))
    }
  }, [state.message])

  if (!state.message) {
    return null
  }

  return (
    <div className={`toast ${state.ok ? "success" : "error"}`} role="status">
      {state.message}
    </div>
  )
}

export function SubmitButton({
  children,
  disabled = false,
  pendingLabel = "Saving...",
  variant = ""
}: {
  children: ReactNode
  disabled?: boolean
  pendingLabel?: string
  variant?: string
}) {
  const { pending } = useFormStatus()

  return (
    <button className={`button ${variant}`} disabled={pending || disabled} type="submit">
      {pending ? <><span className="button-spinner" aria-hidden="true" />{pendingLabel}</> : children}
    </button>
  )
}

export function ImagePreviewInput({
  currentImage,
  label = "Image",
  uploadEndpoint
}: {
  currentImage?: string
  label?: string
  uploadEndpoint?: string
}) {
  const [preview, setPreview] = useState(currentImage ?? "/images/placeholder.svg")
  const [uploadedUrl, setUploadedUrl] = useState("")
  const [uploadError, setUploadError] = useState("")
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    return () => {
      if (preview.startsWith("blob:")) {
        URL.revokeObjectURL(preview)
      }
    }
  }, [preview])

  async function previewFile(file: File | undefined) {
    if (preview.startsWith("blob:")) {
      URL.revokeObjectURL(preview)
    }

    setUploadError("")
    setUploadedUrl("")

    if (!file) {
      setPreview(currentImage ?? "/images/placeholder.svg")
      return
    }

    const localPreview = URL.createObjectURL(file)
    setPreview(localPreview)

    if (!uploadEndpoint) {
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.set("image", file)
      const response = await fetch(uploadEndpoint, {
        method: "POST",
        body: formData
      })
      const result = await response.json() as { error?: string; url?: string }

      if (!response.ok || !result.url) {
        throw new Error(result.error ?? "Image upload failed.")
      }

      setUploadedUrl(result.url)
      setPreview(result.url)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Image upload failed.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <label className="image-upload">
      <span>{label}</span>
      <img alt="" src={preview} />
      <input name="imageUrl" type="hidden" value={uploadedUrl} />
      <input accept="image/*" name="image" onChange={(event) => void previewFile(event.target.files?.[0])} type="file" />
      {uploading ? <small>Uploading image...</small> : null}
      {uploadError ? <small className="form-note warning">{uploadError}</small> : null}
    </label>
  )
}

export function AdminActionForm({
  action,
  children,
  className = "form-grid",
  confirmMessage
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  children: ReactNode
  className?: string
  confirmMessage?: string
}) {
  const [state, formAction] = useActionState(action, emptyState)

  return (
    <>
      <ActionToast state={state} />
      <form
        action={formAction}
        className={className}
        onSubmit={(event) => {
          if (confirmMessage && !window.confirm(confirmMessage)) {
            event.preventDefault()
          }
        }}
      >
        {children}
      </form>
    </>
  )
}

export function AdminDeleteForm({
  action,
  confirmMessage,
  label = "Delete"
}: {
  action: (state: ActionState) => Promise<ActionState>
  confirmMessage?: string
  label?: string
}) {
  const [state, formAction] = useActionState(action, emptyState)

  return (
    <>
      <ActionToast state={state} />
      <form
        action={formAction}
        onSubmit={(event) => {
          if (confirmMessage && !window.confirm(confirmMessage)) {
            event.preventDefault()
          }
        }}
      >
        <SubmitButton pendingLabel="Deleting..." variant="yellow">{label}</SubmitButton>
      </form>
    </>
  )
}

export function EmptyState({
  title,
  message
}: {
  title: string
  message: string
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">+</div>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  )
}

export function LowStockBadge({ lowStockThreshold = 5, saleUnit, stock }: { lowStockThreshold?: number; saleUnit: "EACH" | "LB"; stock: number }) {
  const label = useMemo(() => {
    if (stock <= 0) {
      return "Out of stock"
    }

    if (stock <= lowStockThreshold) {
      return "Low stock"
    }

    return null
  }, [lowStockThreshold, stock])

  if (!label) {
    return <span className="stock">{formatQuantity(stock, saleUnit)} in stock</span>
  }

  return <span className={`stock-warning ${stock <= 0 ? "empty" : ""}`}>{label}: {formatQuantity(Math.max(stock, 0), saleUnit)}</span>
}
