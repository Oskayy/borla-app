import { prisma } from '@/lib/prisma'
import { sendSms } from '@/lib/sms'

// Sends a message to a user: always saved for the in-app banner, and pushed to their phone
// if they turned alerts on. Never throws: a failed alert must not undo the work that triggered it.

export interface Message {
  title: string
  body: string
  url?: string
  sms?: string // also send this text by SMS (keep it short; only for key messages)
}

let webpush: any = null
let pushReady: boolean | null = null

async function getPush(): Promise<any> {
  if (pushReady === false) return null
  if (webpush) return webpush
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:ops@borla.app'
  if (!pub || !priv) {
    pushReady = false
    console.warn('[notify] Push alerts are off: NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set')
    return null
  }
  try {
    const mod = await import('web-push')
    webpush = (mod as any).default ?? mod
    webpush.setVapidDetails(subject, pub, priv)
    pushReady = true
    return webpush
  } catch (e) {
    pushReady = false
    console.warn('[notify] Push alerts are off: the web-push package is not installed', e)
    return null
  }
}

export async function notifyUser(userId: string, msg: Message): Promise<void> {
  if (msg.sms) {
    try {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } })
      await sendSms(u?.phone, msg.sms)
    } catch (e) {
      console.error('[notify] sms failed', e)
    }
  }
  try {
    await prisma.notification.create({
      data: { userId, title: msg.title.slice(0, 120), body: msg.body.slice(0, 500), url: msg.url ?? null },
    })
  } catch (e) {
    console.error('[notify] could not save notification', e)
  }

  const push = await getPush()
  if (!push) return
  let subs: { id: string; endpoint: string; p256dh: string; auth: string }[] = []
  try {
    subs = await prisma.pushSubscription.findMany({ where: { userId } })
  } catch {
    return
  }
  const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url ?? '/dashboard' })
  await Promise.all(
    subs.map(async (s) => {
      try {
        await push.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 60 * 60,
          urgency: 'high',
        })
        await prisma.pushSubscription.update({ where: { id: s.id }, data: { lastUsedAt: new Date() } })
      } catch (e: any) {
        // 404/410: the phone unsubscribed or the browser was reset. Forget it.
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {})
        } else {
          console.warn('[notify] push failed', e?.statusCode ?? e)
        }
      }
    })
  )
}

export async function notifyUsers(userIds: string[], msg: Message): Promise<void> {
  await Promise.all(Array.from(new Set(userIds)).map((id) => notifyUser(id, msg)))
}

// Who hears about dispatch problems and the nightly plan.
export const OPS_ALERT_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER', 'DISPATCHER']

export async function notifyOps(msg: Message): Promise<void> {
  try {
    const staff = await prisma.user.findMany({ where: { role: { in: OPS_ALERT_ROLES as any } }, select: { id: true } })
    await notifyUsers(
      staff.map((u: { id: string }) => u.id),
      msg
    )
  } catch (e) {
    console.error('[notify] could not alert ops', e)
  }
}
