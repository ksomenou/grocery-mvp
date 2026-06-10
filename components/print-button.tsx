"use client"

type PrintButtonProps = {
  label?: string
}

export function PrintButton({ label = "Print order" }: PrintButtonProps) {
  return (
    <button className="button secondary no-print" onClick={() => window.print()} type="button">
      {label}
    </button>
  )
}
