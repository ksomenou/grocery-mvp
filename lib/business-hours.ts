export const businessHours = [
  { label: "Monday-Saturday", hours: "10:00 AM – 9:00 PM" },
  { label: "Sunday", hours: "12:00 PM – 9:00 PM" }
]

export function todaysBusinessHours(date = new Date()) {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long"
  }).format(date)

  return day === "Sunday" ? "12:00 PM – 9:00 PM" : "10:00 AM – 9:00 PM"
}
