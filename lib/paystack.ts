// Calls to Paystack's API (server only). Every function returns { ok, data, error } and never throws.
import { caught } from '@/lib/errors'

const BASE = 'https://api.paystack.co'

export interface PaystackResult {
  ok: boolean
  // Raw JSON from Paystack; its shape depends on the endpoint, and callers check the fields they read.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  error: string
  // true when we can't tell whether Paystack acted (timeout, network error, 5xx). Money may have moved,
  // so never treat an uncertain result as a clean failure.
  uncertain: boolean
  httpStatus: number // 0 when there was no response
}

async function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<PaystackResult> {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return { ok: false, data: null, error: 'PAYSTACK_SECRET_KEY is not set', uncertain: false, httpStatus: 0 }
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.status) {
      return {
        ok: false,
        data: json?.data ?? null,
        error: json?.message || `Paystack error (HTTP ${res.status})`,
        uncertain: res.status >= 500 || json === null,
        httpStatus: res.status,
      }
    }
    return { ok: true, data: json.data, error: '', uncertain: false, httpStatus: res.status }
  } catch (err) {
    const e = caught(err)
    return {
      ok: false,
      data: null,
      error: e?.name === 'TimeoutError' ? 'Paystack did not respond in time' : 'Could not reach Paystack',
      uncertain: true,
      httpStatus: 0,
    }
  }
}

// A mobile money wallet that Paystack can send money to. Returns the recipient code (RCP_...).
export async function createMomoRecipient(args: { name: string; number: string; provider: string }): Promise<PaystackResult> {
  const r = await call('POST', '/transferrecipient', {
    type: 'mobile_money',
    name: args.name,
    account_number: args.number, // local format, e.g. 0244123456
    bank_code: args.provider, // MTN | VOD | ATL
    currency: 'GHS',
  })
  if (r.ok && typeof r.data?.recipient_code !== 'string') {
    return { ok: false, data: r.data, error: 'Paystack did not return a recipient code', uncertain: false, httpStatus: r.httpStatus }
  }
  return r
}

// Sends money from the Paystack balance. `reference` must be 16-50 chars of a-z, 0-9, "-" or "_".
// data.status is usually "pending" (the result arrives by webhook), "success", or "otp" if transfer
// confirmation by OTP is still switched on in the Paystack dashboard.
export async function initiateTransfer(args: { amountGhs: number; recipient: string; reference: string; reason: string }): Promise<PaystackResult> {
  return call('POST', '/transfer', {
    source: 'balance',
    amount: Math.round(args.amountGhs * 100),
    recipient: args.recipient,
    reference: args.reference,
    reason: args.reason.slice(0, 100),
    currency: 'GHS',
  })
}

// Looks up a transfer by our reference (after a timeout, to see whether it went out).
// A 404 means Paystack never received it.
export async function verifyTransfer(reference: string): Promise<PaystackResult & { notFound: boolean }> {
  const r = await call('GET', `/transfer/verify/${encodeURIComponent(reference)}`)
  const notFound = !r.ok && !r.uncertain && (r.httpStatus === 404 || /not found/i.test(r.error))
  return { ...r, notFound }
}

// Refunds all or part of a payment. `transaction` is the payment's Paystack reference.
export async function createRefund(args: { transaction: string; amountGhs: number; merchantNote: string; customerNote: string }): Promise<PaystackResult> {
  return call('POST', '/refund', {
    transaction: args.transaction,
    amount: Math.round(args.amountGhs * 100),
    merchant_note: args.merchantNote.slice(0, 200),
    customer_note: args.customerNote.slice(0, 200),
  })
}

// The Paystack balance that driver payouts come from, in pesewas (null if Paystack didn't answer).
export async function getBalancePesewas(): Promise<number | null> {
  const r = await call('GET', '/balance')
  if (!r.ok || !Array.isArray(r.data)) return null
  const ghs = r.data.find((b: { currency?: string }) => b?.currency === 'GHS')
  return Number.isInteger(ghs?.balance) ? (ghs.balance as number) : null
}

export interface PaystackTransaction {
  reference: string
  amount: number // pesewas
  fees: number | null // pesewas
  paidAt: string | null
}

// Successful customer payments between two times (all pages). null if Paystack didn't answer.
export async function listSuccessfulTransactions(from: Date, to: Date): Promise<PaystackTransaction[] | null> {
  const out: PaystackTransaction[] = []
  for (let page = 1; page <= 50; page++) {
    const q = new URLSearchParams({ perPage: '100', page: String(page), status: 'success', from: from.toISOString(), to: to.toISOString() })
    const r = await call('GET', `/transaction?${q}`)
    if (!r.ok || !Array.isArray(r.data)) return null
    for (const t of r.data) {
      if (t?.currency && t.currency !== 'GHS') continue
      out.push({
        reference: String(t.reference),
        amount: Number(t.amount),
        fees: Number.isInteger(t.fees) ? t.fees : null,
        paidAt: typeof t.paid_at === 'string' ? t.paid_at : null,
      })
    }
    if (r.data.length < 100) break
  }
  return out
}

export interface PaystackSettlementRow {
  id: string
  status: string
  amount: number // pesewas Paystack sends to the bank (after its fees and any refunds deducted)
  settledAt: string | null
}

// Settlements to the bank between two dates. null if Paystack didn't answer.
export async function listSettlements(from: Date, to: Date): Promise<PaystackSettlementRow[] | null> {
  const out: PaystackSettlementRow[] = []
  for (let page = 1; page <= 20; page++) {
    const q = new URLSearchParams({ perPage: '100', page: String(page), from: from.toISOString(), to: to.toISOString() })
    const r = await call('GET', `/settlement?${q}`)
    if (!r.ok || !Array.isArray(r.data)) return null
    for (const s of r.data) {
      const amount = Number.isInteger(s?.effective_amount) ? s.effective_amount : Number(s?.total_amount)
      if (!Number.isFinite(amount)) continue
      out.push({
        id: String(s.id),
        status: String(s.status ?? 'unknown'),
        amount,
        settledAt: typeof s.settlement_date === 'string' ? s.settlement_date : null,
      })
    }
    if (r.data.length < 100) break
  }
  return out
}
