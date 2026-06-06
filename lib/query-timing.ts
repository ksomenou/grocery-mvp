export function createQueryTimer(page: string) {
  let count = 0
  const pageStartedAt = Date.now()

  return {
    async run<T>(label: string, query: () => Promise<T>): Promise<T> {
      const queryNumber = ++count
      const startedAt = Date.now()

      try {
        const result = await query()
        console.info(`[prisma:${page}] #${queryNumber} ${label} ${Date.now() - startedAt}ms`)
        return result
      } catch (error) {
        console.error(`[prisma:${page}] #${queryNumber} ${label} failed after ${Date.now() - startedAt}ms`, error)
        throw error
      }
    },
    flush() {
      console.info(`[prisma:${page}] ${count} queries total in ${Date.now() - pageStartedAt}ms`)
    }
  }
}
