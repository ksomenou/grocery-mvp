"use client"

export function DiscountSortSelect({
  defaultValue,
  name = "sort",
  options
}: {
  defaultValue: string
  name?: string
  options: Array<{ label: string; value: string }>
}) {
  return (
    <select
      className="select"
      defaultValue={defaultValue}
      name={name}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  )
}
