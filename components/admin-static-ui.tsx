import { formatQuantity } from "@/lib/format"

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

export function LowStockBadge({
  lowStockThreshold = 5,
  saleUnit,
  stock
}: {
  lowStockThreshold?: number
  saleUnit: "EACH" | "LB"
  stock: number
}) {
  let label: string | null = null

  if (stock <= 0) {
    label = "Out of stock"
  } else if (stock <= lowStockThreshold) {
    label = "Low stock"
  }

  if (!label) {
    return <span className="stock">{formatQuantity(stock, saleUnit)} in stock</span>
  }

  return <span className={`stock-warning ${stock <= 0 ? "empty" : ""}`}>{label}: {formatQuantity(Math.max(stock, 0), saleUnit)}</span>
}
