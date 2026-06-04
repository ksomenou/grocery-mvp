export const scheduleWindows = [
  "10:00 AM – 12:00 PM",
  "12:00 PM – 2:00 PM",
  "2:00 PM – 4:00 PM",
  "4:00 PM – 6:00 PM",
  "6:00 PM – 9:00 PM"
] as const

export const sundayScheduleWindows = scheduleWindows.slice(1)

export function dateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

export function formatFulfillmentEta(
  fulfillmentMethod: "DELIVERY" | "PICKUP",
  date?: Date | null,
  window?: string | null,
  today = new Date()
) {
  if (!date || !window) {
    return fulfillmentMethod === "DELIVERY" ? "Delivery window selected at checkout" : "Pickup window selected at checkout"
  }

  const selectedDay = dateInputValue(date)
  const currentDay = dateInputValue(today)
  const tomorrowDay = dateInputValue(addCalendarDays(today, 1))
  const dayLabel = selectedDay === currentDay ? "today" : selectedDay === tomorrowDay ? "tomorrow" : formatScheduleDate(date)
  const action = fulfillmentMethod === "DELIVERY" ? "Arrives" : "Pickup ready"
  const normalizedWindow = window.replace(/\s[–-]\s/g, "-")

  return `${action} ${dayLabel} between ${normalizedWindow}`
}

export function addCalendarDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function parseScheduleDate(value?: string | null) {
  if (!value) {
    return null
  }

  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

export function windowsForScheduleDate(date: Date) {
  return date.getDay() === 0 ? sundayScheduleWindows : scheduleWindows
}

export function isValidScheduleWindow(date: Date, window?: string | null) {
  return Boolean(window && windowsForScheduleDate(date).includes(window as (typeof scheduleWindows)[number]))
}

export function formatScheduleDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium"
  }).format(date)
}

export function formatSchedule(date?: Date | null, window?: string | null) {
  if (!date || !window) {
    return ""
  }

  return `${formatScheduleDate(date)} • ${window}`
}
