import { NextResponse } from 'next/server'
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

// Checks the limit and, if allowed, counts this request.
// Returns true when the caller is OVER the limit and should be rejected.
export async function enforceRateLimit(options: Omit<CheckOptions, 'onlyFailures'>): Promise<boolean> {
  if (await isRateLimited(options)) return true
  await recordAttempt(options.identifier, options.action, true)

  // Occasional housekeeping so this table doesn't grow forever.
  if (Math.random() < 0.01) {
    await prisma.rateLimitAttempt.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    })
  }
  return false
}

export function tooManyRequests() {
  return NextResponse.json(
    { error: 'Too many requests. Please slow down and try again shortly.' },
    { status: 429 }
  )
}

// The caller's IP, for per-IP limits. The first X-Forwarded-For value is whatever the caller sent, so it
// can't be trusted. Vercel sets x-vercel-forwarded-for / x-real-ip itself (callers can't override them);
// on other hosts the last X-Forwarded-For entry is the one added by our own proxy.
export function getClientIp(req: Request): string {
  const trusted = req.headers.get('x-vercel-forwarded-for') ?? req.headers.get('x-real-ip')
  if (trusted) return trusted.split(',')[0].trim()
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',').pop()!.trim()
  return 'unknown'
}