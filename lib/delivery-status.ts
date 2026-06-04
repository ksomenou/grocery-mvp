type DeliveryStatus = {
  deliveryLabel: string
  pickupLabel: string
}

function storeHoursForDate(date: Date) {
  const isSunday = date.getDay() === 0
  return {
    closeHour: 21,
    openHour: isSunday ? 12 : 10
  }
}

export function deliveryStatusForDate(date = new Date()): DeliveryStatus {
  const { closeHour, openHour } = storeHoursForDate(date)
  const hour = date.getHours() + date.getMinutes() / 60
  const isOpen = hour >= openHour && hour < closeHour

  return {
    deliveryLabel: isOpen ? "Delivery today" : "Delivery tomorrow",
    pickupLabel: isOpen ? "Pickup available today" : "Pickup available tomorrow"
  }
}

export function deliveryAvailabilityMessage(zipCode: string) {
  const normalized = zipCode.trim()
  const { deliveryLabel } = deliveryStatusForDate()

  if (!normalized) {
    return "Enter ZIP for local delivery"
  }

  if (/^\d{5}$/.test(normalized)) {
    return deliveryLabel === "Delivery today" ? "Delivery available today" : "Delivery available tomorrow"
  }

  return "Enter a valid 5-digit ZIP"
}
