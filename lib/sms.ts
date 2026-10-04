import { normalizeGhanaPhone } from '@/lib/phone'

// Text messages through Arkesel (a Ghana SMS provider). Off unless ARKESEL_API_KEY is set.
// SMS_SENDER_ID is the name shown as the sender (max 11 letters/digits, registered with Arkesel), e.g. "Trashit".
// Never throws: a failed text must not undo the work that triggered it.
export async function sendSms(phone: string | null | undefined, message: string): Promise<boolean> {
  const key = process.env.ARKESEL_API_KEY
  if (!key) return false
  const to = normalizeGhanaPhone(phone ?? '')
  if (!to) return false
  const sender = (process.env.SMS_SENDER_ID || 'Trashit').slice(0, 11)
  try {
    const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender, message: message.slice(0, 459), recipients: [to] }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      console.warn('[sms] Arkesel refused the message', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (e) {
    console.warn('[sms] could not reach Arkesel', e)
    return false
  }
}
