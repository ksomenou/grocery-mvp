"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"

type DiscountProductOption = {
  categoryName: string
  id: string
  name: string
}

function previewMoney(value: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) {
    return ""
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    style: "currency"
  }).format(amount)
}

export function DiscountScopeFields({
  defaultProductId = "",
  defaultScope = "ORDER",
  defaultType = "PERCENT",
  defaultPercentOff = "",
  defaultAmountOff = "",
  products
}: {
  defaultProductId?: string | null
  defaultScope?: "ORDER" | "PRODUCT"
  defaultType?: "PERCENT" | "FIXED"
  defaultPercentOff?: string | number | null
  defaultAmountOff?: string | number | null
  products: DiscountProductOption[]
}) {
  const [scope, setScope] = useState<"ORDER" | "PRODUCT">(defaultScope)
  const [type, setType] = useState<"PERCENT" | "FIXED">(defaultType)
  const [query, setQuery] = useState("")
  const [selectedProductId, setSelectedProductId] = useState(defaultProductId ?? "")
  const [percentOff, setPercentOff] = useState(String(defaultPercentOff ?? ""))
  const [amountOff, setAmountOff] = useState(String(defaultAmountOff ?? ""))
  const [activeIndex, setActiveIndex] = useState(0)
  const [minimumOrder, setMinimumOrder] = useState("")
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  )

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const matches = normalized
      ? products.filter((product) => `${product.name} ${product.categoryName}`.toLowerCase().includes(normalized))
      : products

    return matches.slice(0, 12)
  }, [products, query])

  useEffect(() => {
    const selectedIndex = filteredProducts.findIndex((product) => product.id === selectedProductId)
    const index = selectedIndex >= 0 ? selectedIndex : activeIndex
    optionRefs.current[index]?.scrollIntoView({ block: "nearest" })
  }, [activeIndex, filteredProducts, selectedProductId])

  useEffect(() => {
    const form = rootRef.current?.closest("form")
    if (!(form instanceof HTMLFormElement)) {
      return
    }

    const syncMinimumOrder = () => {
      const input = form.elements.namedItem("minimumOrderAmount")
      setMinimumOrder(input instanceof HTMLInputElement ? input.value : "")
    }

    syncMinimumOrder()
    form.addEventListener("input", syncMinimumOrder)
    form.addEventListener("change", syncMinimumOrder)
    return () => {
      form.removeEventListener("input", syncMinimumOrder)
      form.removeEventListener("change", syncMinimumOrder)
    }
  }, [])

  function selectProduct(product: DiscountProductOption) {
    setSelectedProductId(product.id)
    setQuery("")
    window.setTimeout(() => document.dispatchEvent(new Event("freshcart-discount-change")), 0)
  }

  const previewText = useMemo(() => {
    const minimum = Number(minimumOrder)
    const minimumText = Number.isFinite(minimum) && minimum > 0 ? `orders above ${previewMoney(minimumOrder)}` : ""
    const target = scope === "PRODUCT" && selectedProduct ? selectedProduct.name : minimumText || "entire order"

    if (type === "PERCENT" && percentOff) {
      return `Customers save ${percentOff}% on ${target}.`
    }

    if (type === "FIXED" && amountOff) {
      return `Customers save ${previewMoney(amountOff)} on ${target}.`
    }

    return scope === "PRODUCT" ? "Select a product and discount value to preview this code." : "Enter a discount value to preview this code."
  }, [amountOff, minimumOrder, percentOff, scope, selectedProduct, type])

  return (
    <div className="discount-scope-fields" ref={rootRef}>
      <div className="form-row">
        <label className="form-field">
          <span>Discount scope</span>
          <select
            className="select"
            name="scope"
            onChange={(event) => {
              const nextScope = event.target.value as "ORDER" | "PRODUCT"
              setScope(nextScope)
              setActiveIndex(0)
              if (nextScope === "ORDER") {
                setSelectedProductId("")
                setQuery("")
              }
              window.setTimeout(() => document.dispatchEvent(new Event("freshcart-discount-change")), 0)
            }}
            value={scope}
          >
            <option value="ORDER">Entire order</option>
            <option value="PRODUCT">Specific product</option>
          </select>
        </label>
        <label className="form-field">
          <span>Discount type</span>
          <select
            className="select"
            name="type"
            onChange={(event) => {
              const nextType = event.target.value as "PERCENT" | "FIXED"
              setType(nextType)
              if (nextType === "PERCENT") {
                setAmountOff("")
              } else {
                setPercentOff("")
              }
              window.setTimeout(() => document.dispatchEvent(new Event("freshcart-discount-change")), 0)
            }}
            value={type}
          >
            <option value="PERCENT">Percent</option>
            <option value="FIXED">Fixed amount</option>
          </select>
        </label>
      </div>

      {scope === "PRODUCT" ? (
        <div className="discount-combobox">
          <label className="form-field">
            <span>Product</span>
            <input
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded="true"
              autoComplete="off"
              className="field"
              onChange={(event) => {
                setQuery(event.target.value)
                setSelectedProductId("")
                setActiveIndex(0)
              }}
              onKeyDown={(event) => {
                if (filteredProducts.length === 0) {
                  return
                }

                if (event.key === "ArrowDown") {
                  event.preventDefault()
                  setActiveIndex((current) => Math.min(current + 1, filteredProducts.length - 1))
                }

                if (event.key === "ArrowUp") {
                  event.preventDefault()
                  setActiveIndex((current) => Math.max(current - 1, 0))
                }

                if (event.key === "Enter") {
                  event.preventDefault()
                  selectProduct(filteredProducts[activeIndex])
                }
              }}
              placeholder="Search product name or category"
              role="combobox"
              type="search"
              value={selectedProduct && !query ? `${selectedProduct.name} - ${selectedProduct.categoryName}` : query}
            />
          </label>
          <input name="productId" type="hidden" value={selectedProductId} />
          {selectedProduct ? (
            <div className="selected-discount-product">
              <div>
                <strong>{selectedProduct.name}</strong>
                <span>{selectedProduct.categoryName}</span>
              </div>
              <button
                onClick={() => {
                  setSelectedProductId("")
                  setQuery("")
                }}
                type="button"
              >
                Change
              </button>
            </div>
          ) : (
            <p className="discount-help">Select one product below before saving this product-specific discount.</p>
          )}
          <div className="discount-combobox-list" id={listboxId} role="listbox">
            {filteredProducts.length === 0 ? (
              <p>No products found.</p>
            ) : filteredProducts.map((product) => (
              <button
                aria-selected={product.id === selectedProductId}
                className={[
                  product.id === selectedProductId ? "selected" : "",
                  product.id !== selectedProductId && filteredProducts[activeIndex]?.id === product.id ? "active" : ""
                ].filter(Boolean).join(" ")}
                key={product.id}
                onClick={() => selectProduct(product)}
                ref={(node) => {
                  optionRefs.current[filteredProducts.indexOf(product)] = node
                }}
                role="option"
                type="button"
              >
                <span>{product.name}</span>
                <small>{product.id === selectedProductId ? "Selected" : product.categoryName}</small>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <input name="productId" type="hidden" value="" />
      )}

      <div className="form-row">
        <label className="form-field">
          <span>Percent off</span>
          <input
            className="field"
            disabled={type !== "PERCENT"}
            max="100"
            min="1"
            name="percentOff"
            onChange={(event) => setPercentOff(event.target.value)}
            placeholder="10"
            required={type === "PERCENT"}
            step="1"
            type="number"
            value={type === "PERCENT" ? percentOff : ""}
          />
        </label>
        <label className="form-field">
          <span>Amount off</span>
          <input
            className="field"
            disabled={type !== "FIXED"}
            min="0.01"
            name="amountOff"
            onChange={(event) => setAmountOff(event.target.value)}
            placeholder="5.00"
            required={type === "FIXED"}
            step="0.01"
            type="number"
            value={type === "FIXED" ? amountOff : ""}
          />
        </label>
      </div>
      <div className="discount-preview" aria-live="polite">
        {previewText}
      </div>
    </div>
  )
}
