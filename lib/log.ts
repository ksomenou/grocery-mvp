type LogContext = Record<string, unknown>

function serializeContext(context?: LogContext) {
  if (!context) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => {
      return typeof value !== "undefined" && typeof value !== "function"
    })
  )
}

export function logInfo(message: string, context?: LogContext) {
  if (process.env.NODE_ENV === "test") {
    return
  }

  console.info(`[freshcart] ${message}`, serializeContext(context) ?? "")
}

export function logError(message: string, error: unknown, context?: LogContext) {
  const safeError = error instanceof Error
    ? { name: error.name, message: error.message }
    : { message: "Unknown error" }

  console.error(`[freshcart] ${message}`, { ...safeError, ...serializeContext(context) })
}
