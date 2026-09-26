import { prisma } from '@/lib/prisma'

interface CheckOptions {
  identifier: string
  action: string
  maxAttempts: number
  windowMinutes: number
  onlyFailures?: boolean
}

export async function isRateLimited({
  identifier,
  action,
  maxAttempts,
  windowMinutes,
  onlyFailures = false,
}: CheckOptions): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000)

  const count = await prisma.rateLimitAttempt.count({
    where: {
      identifier,
      action,
      createdAt: { gte: windowStart },
      ...(onlyFailures ? { success: false } : {}),
    },
  })

  return count >= maxAttempts
}

export async function recordAttempt(identifier: string, action: string, success: boolean) {
  await prisma.rateLimitAttempt.create({
    data: { identifier, action, success },
  })
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'unknown'
}