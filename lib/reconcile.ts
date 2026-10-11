// Daily reconciliation (Payment flow rewrite, step 6). Pure comparisons so they can be tested; amounts in pesewas.
// Any difference that isn't zero is shown to Finance (Finance page) until someone reviews it.

export const RECONCILE_MINUTES = 7 * 60 // 7am Accra: yesterday is checked
export const SETTLEMENT_CONFIRM_DAYS = 3 // settlements not confirmed as received after this are flagged

export interface CheckResult {
  name: string
  ok: boolean
  summary: string // one plain sentence
  details: string[] // what differs (at most a few lines)
}

const ghs = (p: number) => `GHS ${(p / 100).toFixed(2)}`
const few = (xs: string[]) => xs.slice(0, 10)

// Payments recorded in the app vs successful transactions at Paystack for the same day.
export function comparePayments(app: { reference: string; amount: number }[], paystack: { reference: string; amount: number }[]): CheckResult {
  const a = new Map(app.map((p) => [p.reference, p.amount]))
  const p = new Map(paystack.map((t) => [t.reference, t.amount]))
  const missingInApp = paystack.filter((t) => !a.has(t.reference)).map((t) => `${t.reference} (${ghs(t.amount)}) is at Paystack but not in the app`)
  const missingAtPaystack = app.filter((x) => !p.has(x.reference)).map((x) => `${x.reference} (${ghs(x.amount)}) is in the app but not at Paystack`)
  const different = app
    .filter((x) => p.has(x.reference) && p.get(x.reference) !== x.amount)
    .map((x) => `${x.reference}: app ${ghs(x.amount)}, Paystack ${ghs(p.get(x.reference)!)}`)
  const details = [...missingInApp, ...missingAtPaystack, ...different]
  const appTotal = app.reduce((s, x) => s + x.amount, 0)
  const psTotal = paystack.reduce((s, x) => s + x.amount, 0)
  return {
    name: 'Payments',
    ok: details.length === 0,
    summary: `${app.length} payment(s), ${ghs(appTotal)} in the app; ${paystack.length}, ${ghs(psTotal)} at Paystack`,
    details: few(details),
  }
}

// Paystack's fee per payment vs what the ledger recorded (estimated fees show up here until corrected).
export function compareFees(ledger: Map<string, number>, paystack: { reference: string; fees: number | null }[]): CheckResult {
  const details = paystack
    .filter((t) => t.fees != null && ledger.has(t.reference) && ledger.get(t.reference) !== t.fees)
    .map((t) => `${t.reference}: ledger ${ghs(ledger.get(t.reference)!)}, Paystack ${ghs(t.fees!)}`)
  return { name: 'Payment fees', ok: details.length === 0, summary: details.length ? `${details.length} fee(s) differ` : 'Fees match Paystack', details: few(details) }
}

// The Paystack balance vs the ledger, allowing for payouts Paystack has taken but not yet confirmed.
export function compareBalance(args: { ledger: number; inFlight: number; paystack: number | null }): CheckResult {
  if (args.paystack == null) return { name: 'Paystack balance', ok: false, summary: 'Paystack did not report the balance', details: [] }
  const expected = args.ledger - args.inFlight
  const diff = args.paystack - expected
  return {
    name: 'Paystack balance',
    ok: diff === 0,
    summary: diff === 0 ? `${ghs(args.paystack)}, as the ledger expects` : `Paystack shows ${ghs(args.paystack)}, the ledger expects ${ghs(expected)} (difference ${ghs(diff)})`,
    details: diff === 0 ? [] : ['Was a top-up or a settlement not recorded on the Finance page?'],
  }
}

// Each driver's balance in the ledger vs the wallet drivers see.
export function compareDrivers(rows: { driverId: string; ledger: number; wallet: number }[]): CheckResult {
  const off = rows.filter((r) => r.ledger !== r.wallet)
  return {
    name: 'Driver balances',
    ok: off.length === 0,
    summary: off.length ? `${off.length} driver balance(s) differ from the ledger` : `${rows.length} driver balance(s) match the ledger`,
    details: few(off.map((r) => `${r.driverId.slice(0, 8)}: ledger ${ghs(r.ledger)}, wallet ${ghs(r.wallet)}`)),
  }
}

// Simple counts that must be zero (unbalanced journals, finished orders still holding money, splits that don't add up...).
export function mustBeZero(name: string, count: number, what: string): CheckResult {
  return { name, ok: count === 0, summary: count === 0 ? `No ${what}` : `${count} ${what}`, details: [] }
}
