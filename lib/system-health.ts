// System health for the ops console's top bar. Each item is worked out from real signals (never secret values):
// whether a key is set and what kind, and when the scheduler last checked in.

import { prisma } from '@/lib/prisma'

export const HEARTBEAT_KEY = 'heartbeat:dispatch' // stamped by /api/cron/dispatch on every run (every 2 minutes)

export type HealthState = 'ok' | 'warn' | 'off'
export interface HealthItem {
  label: string
  state: HealthState
  text: string
}

// The scheduler runs every 2 minutes; allow a couple of missed beats before calling it late.
export function schedulerHealth(lastBeat: Date | null, now: Date): HealthItem {
  if (!lastBeat) return { label: 'Scheduler', state: 'warn', text: 'No signal yet' }
  const mins = (now.getTime() - lastBeat.getTime()) / 60_000
  if (mins <= 6) return { label: 'Scheduler', state: 'ok', text: 'Running' }
  if (mins <= 30) return { label: 'Scheduler', state: 'warn', text: `Late (${Math.round(mins)} min)` }
  return { label: 'Scheduler', state: 'off', text: 'Not running' }
}

export function keyHealth(env: Record<string, string | undefined>): HealthItem[] {
  const paystack = env.PAYSTACK_SECRET_KEY ?? ''
  const service = env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  return [
    paystack.startsWith('sk_live_')
      ? { label: 'Paystack', state: 'ok', text: 'Live' }
      : paystack.startsWith('sk_test_')
      ? { label: 'Paystack', state: 'warn', text: 'Test mode' }
      : { label: 'Paystack', state: 'off', text: 'Not set up' },
    // Supabase turned off the old JWT-style service keys; uploads and account admin need an sb_secret_ key.
    service.startsWith('sb_secret_')
      ? { label: 'Storage & accounts', state: 'ok', text: 'Working' }
      : service
      ? { label: 'Storage & accounts', state: 'warn', text: 'Old key: replace it' }
      : { label: 'Storage & accounts', state: 'off', text: 'Not set up' },
    env.ARKESEL_API_KEY && env.SMS_SENDER_ID ? { label: 'SMS', state: 'ok', text: 'On' } : { label: 'SMS', state: 'off', text: 'Off' },
  ]
}

export async function systemHealth(): Promise<HealthItem[]> {
  const beat = await prisma.jobRun.findUnique({ where: { key: HEARTBEAT_KEY }, select: { ranAt: true } }).catch(() => null)
  return [schedulerHealth(beat?.ranAt ?? null, new Date()), ...keyHealth(process.env)]
}
