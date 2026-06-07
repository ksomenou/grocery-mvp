import type { Prisma } from "@prisma/client"

export function testOrderCleanupCutoff() {
  const value = process.env.TEST_DATA_CLEANUP_BEFORE?.trim()

  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function testOrderCleanupWhere(): Prisma.OrderWhereInput {
  const cutoff = testOrderCleanupCutoff()
  const criteria: Prisma.OrderWhereInput[] = [
    { paymentStatus: { in: ["PENDING", "FAILED"] } }
  ]

  if (cutoff) {
    criteria.push({ createdAt: { lt: cutoff } })
  }

  return { OR: criteria }
}
