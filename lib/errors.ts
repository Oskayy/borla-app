// The fields our catch blocks look at: our own thrown messages ('STATE_CHANGED'),
// Prisma codes ('P2002', 'P2025', 'P2034'), fetch timeouts and web-push status codes.
export type CaughtError = {
  message?: string
  code?: string
  name?: string
  statusCode?: number
} | null | undefined

export function caught(e: unknown): CaughtError {
  return typeof e === 'object' && e !== null ? (e as CaughtError) : undefined
}

export function errorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  return e instanceof Error && e.message ? e.message : fallback
}
