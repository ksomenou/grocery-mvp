import { AdminNav } from "@/components/admin-nav"
import { EmptyState } from "@/components/admin-static-ui"
import { AdminActionForm, SubmitButton } from "@/components/admin-ui"
import { ConfirmLink } from "@/components/confirm-link"
import { CopyButton } from "@/components/copy-button"
import { DiscountCodeInput } from "@/components/discount-code-input"
import { DiscountFormSubmit } from "@/components/discount-form-submit"
import { DiscountScopeFields } from "@/components/discount-scope-fields"
import { DiscountSortSelect } from "@/components/discount-sort-select"
import { ScrollIntoView } from "@/components/scroll-into-view"
import { createDiscountCode, deleteDiscountCode, disableDiscountCode, enableDiscountCode, updateDiscountCode } from "@/lib/actions"
import { discountCodeLabel } from "@/lib/discounts"
import { formatMoney, titleCase } from "@/lib/format"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

function dateValue(value: Date | null) {
  return value ? value.toLocaleDateString("en-US", { dateStyle: "medium" }) : "No date"
}

function relativeDate(value: Date | null, label: "starts" | "expires") {
  if (!value) {
    return "No date set"
  }

  const now = new Date()
  const diff = value.getTime() - now.getTime()
  const days = Math.ceil(diff / 86_400_000)
  if (label === "expires" && diff < 0) {
    return "Expired"
  }

  if (days === 0) {
    return label === "starts" ? "Starts today" : "Expires today"
  }

  if (days > 0) {
    return label === "starts" ? `Starts in ${days} day${days === 1 ? "" : "s"}` : `Expires in ${days} day${days === 1 ? "" : "s"}`
  }

  const ago = Math.abs(days)
  return label === "starts" ? `Started ${ago} day${ago === 1 ? "" : "s"} ago` : `Expired ${ago} day${ago === 1 ? "" : "s"} ago`
}

function inputDateValue(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : ""
}

function isExpired(value: Date | null) {
  return value ? value < new Date() : false
}

function statusBadge(discount: { endsAt: Date | null; isActive: boolean }) {
  if (isExpired(discount.endsAt)) {
    return <span className="status-badge discount-status-expired">Expired</span>
  }

  if (!discount.isActive) {
    return <span className="status-badge discount-status-inactive">Inactive</span>
  }

  return <span className="status-badge discount-status-active">Active</span>
}

function usagePercent(discount: { maxRedemptions: number | null; redemptionCount: number }) {
  if (!discount.maxRedemptions) {
    return 0
  }

  return Math.min(100, Math.round((discount.redemptionCount / discount.maxRedemptions) * 100))
}

function scopeLabel(discount: {
  product: { name: string } | null
  productId: string | null
  scope: "ORDER" | "PRODUCT"
}) {
  if (discount.scope === "PRODUCT" || discount.productId) {
    return "Specific product"
  }

  return "Entire order"
}

function discountSort(sort: string): Prisma.DiscountCodeOrderByWithRelationInput | Prisma.DiscountCodeOrderByWithRelationInput[] {
  if (sort === "oldest") {
    return { createdAt: "asc" }
  }

  if (sort === "active") {
    return [{ isActive: "desc" }, { createdAt: "desc" }]
  }

  if (sort === "most-used") {
    return [{ redemptionCount: "desc" }, { createdAt: "desc" }]
  }

  return { createdAt: "desc" }
}

export default async function AdminDiscountsPage({
  searchParams
}: {
  searchParams?: Promise<{ edit?: string; filter?: string; sort?: string }>
}) {
  const params = await searchParams
  const sort = params?.sort ?? "newest"
  const filter = params?.filter ?? "all"
  const editId = params?.edit ?? ""
  const [discounts, products] = await Promise.all([
    prisma.discountCode.findMany({
      include: { product: true },
      orderBy: discountSort(sort)
    }),
    prisma.product.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: { name: "asc" }
    })
  ])
  const productOptions = products.map((product) => ({
    categoryName: titleCase(product.category.name),
    id: product.id,
    name: titleCase(product.name)
  }))
  const filteredDiscounts = discounts.filter((discount) => {
    if (filter === "active") {
      return discount.isActive && !isExpired(discount.endsAt)
    }
    if (filter === "expired") {
      return isExpired(discount.endsAt)
    }
    if (filter === "product") {
      return discount.scope === "PRODUCT" || Boolean(discount.productId)
    }
    if (filter === "order") {
      return discount.scope === "ORDER" && !discount.productId
    }
    return true
  })
  const sortedDiscounts = sort === "expired"
    ? [...filteredDiscounts].sort((a, b) => Number(isExpired(b.endsAt)) - Number(isExpired(a.endsAt)) || b.createdAt.getTime() - a.createdAt.getTime())
    : filteredDiscounts
  const editingDiscount = editId ? discounts.find((discount) => discount.id === editId) ?? null : null
  const formAction = editingDiscount ? updateDiscountCode.bind(null, editingDiscount.id) : createDiscountCode
  const activeDiscounts = discounts.filter((discount) => discount.isActive && !isExpired(discount.endsAt)).length
  const expiredDiscounts = discounts.filter((discount) => isExpired(discount.endsAt)).length
  const totalRedemptions = discounts.reduce((total, discount) => total + discount.redemptionCount, 0)
  const topDiscount = discounts.reduce<(typeof discounts)[number] | null>((best, discount) => {
    if (!best || discount.redemptionCount > best.redemptionCount) {
      return discount
    }
    return best
  }, null)
  const existingCodes = discounts.map((discount) => discount.code)

  return (
    <main className="shell">
      {editingDiscount ? <ScrollIntoView selector="#discount-form-panel" /> : null}
      <div className="page-title">
        <p className="admin-kicker">Store admin</p>
        <h1>Discounts</h1>
        <p>Create and manage grocery checkout discount codes.</p>
        <AdminNav active="dashboard" />
      </div>

      <div className="admin-shell admin-discount-shell">
        <section className={`panel admin-discount-form-panel ${editingDiscount ? "editing" : ""}`} id="discount-form-panel">
          <AdminActionForm action={formAction}>
            <div className="discount-form-head">
              <h2 style={{ margin: 0 }}>{editingDiscount ? "Edit discount" : "Create discount"}</h2>
              {editingDiscount ? <ConfirmLink className="copy-button" href="/admin/discounts">Cancel editing</ConfirmLink> : null}
            </div>
            {editingDiscount ? <p className="discount-editing-note">Currently editing {editingDiscount.code}</p> : null}
            <DiscountCodeInput defaultValue={editingDiscount?.code ?? ""} />
            <DiscountScopeFields
              defaultAmountOff={editingDiscount?.amountOffCents ? (editingDiscount.amountOffCents / 100).toFixed(2) : ""}
              defaultPercentOff={editingDiscount?.percentOff ?? ""}
              defaultProductId={editingDiscount?.productId ?? ""}
              defaultScope={editingDiscount?.scope ?? "ORDER"}
              defaultType={editingDiscount?.type ?? "PERCENT"}
              products={productOptions}
            />
            <div className="form-row">
              <label className="form-field">
                <span>Active</span>
                <select className="select" defaultValue={editingDiscount?.isActive === false ? "" : "on"} name="isActive">
                  <option value="on">Active</option>
                  <option value="">Inactive</option>
                </select>
              </label>
            </div>
            <div className="form-row">
              <label className="form-field">
                <span>Start date</span>
                <input className="field" defaultValue={inputDateValue(editingDiscount?.startsAt ?? null)} name="startsAt" type="date" />
              </label>
              <label className="form-field">
                <span>End date</span>
                <input className="field" defaultValue={inputDateValue(editingDiscount?.endsAt ?? null)} name="endsAt" type="date" />
              </label>
            </div>
            <div className="form-row">
              <label className="form-field">
                <span>Max redemptions</span>
                <input className="field" defaultValue={editingDiscount?.maxRedemptions ?? ""} min="1" name="maxRedemptions" placeholder="100" step="1" type="number" />
              </label>
              <label className="form-field">
                <span>Minimum order amount</span>
                <input className="field" defaultValue={editingDiscount?.minimumOrderCents ? (editingDiscount.minimumOrderCents / 100).toFixed(2) : ""} min="0" name="minimumOrderAmount" placeholder="25.00" step="0.01" type="number" />
              </label>
            </div>
            <DiscountFormSubmit
              cancelHref={editingDiscount ? "/admin/discounts" : undefined}
              confirmMessage={editingDiscount?.isActive ? `Save changes to active discount code ${editingDiscount.code}?` : undefined}
              currentCode={editingDiscount?.code}
              existingCodes={existingCodes}
              label={editingDiscount ? "Save changes" : "Create discount"}
              pendingLabel={editingDiscount ? "Saving..." : "Creating..."}
            />
          </AdminActionForm>
        </section>

        <section className="admin-product-panel">
          <div className="discount-stats">
            <div>
              <span aria-hidden="true">%</span>
              <strong>{activeDiscounts}</strong>
              <span>Active discounts{discounts.length ? ` (${Math.round((activeDiscounts / discounts.length) * 100)}%)` : ""}</span>
            </div>
            <div>
              <span aria-hidden="true">!</span>
              <strong>{expiredDiscounts}</strong>
              <span>Expired discounts{discounts.length ? ` (${Math.round((expiredDiscounts / discounts.length) * 100)}%)` : ""}</span>
            </div>
            <div>
              <span aria-hidden="true">#</span>
              <strong>{totalRedemptions}</strong>
              <span>Total redemptions</span>
            </div>
            <div>
              <span aria-hidden="true">^</span>
              <strong>{topDiscount && topDiscount.redemptionCount > 0 ? topDiscount.code : "No usage data yet"}</strong>
              <span>Highest performing code</span>
            </div>
          </div>
          <div className="admin-list-toolbar">
            <div>
              <h2>Discount codes</h2>
              <p>{sortedDiscounts.length} total codes</p>
            </div>
            <form className="admin-search" method="get">
              <span>Filter discounts</span>
              <DiscountSortSelect
                defaultValue={filter}
                name="filter"
                options={[
                  { label: "All discounts", value: "all" },
                  { label: "Active", value: "active" },
                  { label: "Expired", value: "expired" },
                  { label: "Product-specific", value: "product" },
                  { label: "Entire order", value: "order" }
                ]}
              />
              <span>Sort discounts</span>
              <DiscountSortSelect
                defaultValue={sort}
                options={[
                  { label: "Newest", value: "newest" },
                  { label: "Oldest", value: "oldest" },
                  { label: "Active", value: "active" },
                  { label: "Expired", value: "expired" },
                  { label: "Most used", value: "most-used" }
                ]}
              />
            </form>
          </div>
          <div className="admin-list">
            {sortedDiscounts.length === 0 ? (
              <EmptyState title="No discount codes yet" message="Create a checkout discount when you are ready to run a grocery promotion." />
            ) : sortedDiscounts.map((discount) => (
              <article className={`admin-card discount-card ${isExpired(discount.endsAt) ? "expired" : ""}`} key={discount.id}>
                <div className="admin-card-main">
                  <div className="admin-card-head">
                    <div className="admin-product-summary">
                      <p className="muted">{discount.type === "PERCENT" ? "Percent discount" : "Fixed discount"}</p>
                      <h2 className="discount-code-title">
                        <span>{discount.code}</span>
                      </h2>
                      {statusBadge(discount)}
                    </div>
                    <div className="admin-price discount-amount">
                      <span>{discountCodeLabel(discount)}</span>
                    </div>
                  </div>
                  <div className="admin-card-actions discount-actions">
                    <CopyButton label="Copy" value={discount.code} />
                    <ConfirmLink
                      className="button secondary"
                      href={`/admin/discounts?edit=${discount.id}`}
                      message={discount.isActive ? `Edit active discount code ${discount.code}?` : undefined}
                    >
                      Edit
                    </ConfirmLink>
                    {discount.isActive ? (
                      <AdminActionForm
                        action={disableDiscountCode.bind(null, discount.id)}
                        className="admin-card-actions"
                        confirmMessage={`Disable discount code ${discount.code}?`}
                      >
                        <SubmitButton pendingLabel="Disabling..." variant="secondary">Disable</SubmitButton>
                      </AdminActionForm>
                    ) : (
                      <AdminActionForm
                        action={enableDiscountCode.bind(null, discount.id)}
                        className="admin-card-actions"
                        confirmMessage={`Enable discount code ${discount.code}?`}
                      >
                        <SubmitButton pendingLabel="Enabling...">Enable</SubmitButton>
                      </AdminActionForm>
                    )}
                    <AdminActionForm
                      action={deleteDiscountCode.bind(null, discount.id)}
                      className="admin-card-actions"
                      confirmMessage={`Archive discount code ${discount.code}? Redemption history will be preserved.`}
                    >
                      <SubmitButton pendingLabel="Archiving..." variant="danger">Archive</SubmitButton>
                    </AdminActionForm>
                  </div>
                  <div className="order-grid">
                    <div>
                      <strong>Usage</strong>
                      <div className="discount-usage">
                        <span>{discount.maxRedemptions ? `${discount.redemptionCount} of ${discount.maxRedemptions} used` : `${discount.redemptionCount} used`}</span>
                        {discount.maxRedemptions ? <strong>{usagePercent(discount)}% used</strong> : null}
                        {discount.maxRedemptions ? <div><span style={{ width: `${usagePercent(discount)}%` }} /></div> : null}
                      </div>
                    </div>
                    <div>
                      <strong>Scope</strong>
                      <p>{scopeLabel(discount)}</p>
                    </div>
                    <div>
                      <strong>Product</strong>
                      <p>{discount.product ? titleCase(discount.product.name) : "None"}</p>
                    </div>
                    <div>
                      <strong>Start date</strong>
                      <p>{dateValue(discount.startsAt)}</p>
                      <p className="muted">{relativeDate(discount.startsAt, "starts")}</p>
                    </div>
                    <div>
                      <strong>End date</strong>
                      <p>{dateValue(discount.endsAt)}</p>
                      <p className="muted">{relativeDate(discount.endsAt, "expires")}</p>
                    </div>
                    <div>
                      <strong>Minimum order</strong>
                      <p>{discount.minimumOrderCents ? formatMoney(discount.minimumOrderCents) : "No minimum"}</p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
