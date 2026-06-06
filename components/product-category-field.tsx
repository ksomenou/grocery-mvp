"use client"

import { useEffect, useId, useState } from "react"

import { titleCase } from "@/lib/format"

type ProductCategoryFieldProps = {
  categories: string[]
  defaultValue?: string
}

export function ProductCategoryField({ categories, defaultValue = "" }: ProductCategoryFieldProps) {
  const datalistId = useId()
  const [isMobile, setIsMobile] = useState(false)
  const options = Array.from(new Set(defaultValue ? [...categories, defaultValue] : categories))

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)")
    const update = () => setIsMobile(query.matches)

    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  return (
    <label className="form-field product-category-field">
      <span>Product category</span>
      <input
        className="field category-input-desktop"
        defaultValue={defaultValue}
        disabled={isMobile}
        list={datalistId}
        name="categoryName"
        placeholder="Select or type category"
        required
      />
      <datalist id={datalistId}>
        {options.map((categoryName) => (
          <option key={categoryName} value={categoryName} />
        ))}
      </datalist>
      <select
        className="select category-select-mobile"
        defaultValue={defaultValue}
        disabled={!isMobile}
        name="categoryName"
        required
      >
        <option value="" disabled>Select category</option>
        {options.map((categoryName) => (
          <option key={categoryName} value={categoryName}>{titleCase(categoryName)}</option>
        ))}
      </select>
    </label>
  )
}
