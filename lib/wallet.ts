// Driver earnings and withdrawals. Pure functions so they can be tested.
// Amounts are in cedis; sums are done in pesewas to avoid rounding drift.

export const MIN_WITHDRAWAL_GHS = 10 // placeholder: smallest amount a driver can withdraw
export const MAX_WITHDRAWAL_GHS = 5000 // placeholder: largest single withdrawal

// Withdrawals that use up balance: waiting, being sent, or sent.
export const HOLDING_STATUSES = ['REQUESTED', 'PROCESSING', 'PAID']

export function toPesewas(ghs: number): number {
  return Math.round(ghs * 100)
}

export interface WalletSummary {
  earned: number // all earnings ever
  paidOut: number // withdrawals sent
  pending: number // withdrawals requested or being sent
  available: number // can be withdrawn now
}

export function summarizeWallet(
  earnings: number[],
  withdrawals: { amount: number; status: string }[]
): WalletSummary {
  const earned = earnings.reduce((s, a) => s + toPesewas(a), 0)
  const paid = withdrawals.filter((w) => w.status === 'PAID').reduce((s, w) => s + toPesewas(w.amount), 0)
  const pending = withdrawals
    .filter((w) => w.status === 'REQUESTED' || w.status === 'PROCESSING')
    .reduce((s, w) => s + toPesewas(w.amount), 0)
  return {
    earned: earned / 100,
    paidOut: paid / 100,
    pending: pending / 100,
    available: Math.max(0, earned - paid - pending) / 100,
  }
}

// Checks a withdrawal request. Returns an error message, or '' if it's fine.
export function checkWithdrawal(amount: unknown, available: number): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return 'Please enter an amount'
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return 'Amounts can have at most 2 decimal places'
  if (amount < MIN_WITHDRAWAL_GHS) return `The smallest withdrawal is GHS ${MIN_WITHDRAWAL_GHS}`
  if (amount > MAX_WITHDRAWAL_GHS) return `The largest single withdrawal is GHS ${MAX_WITHDRAWAL_GHS}`
  if (toPesewas(amount) > toPesewas(available)) return `You can withdraw up to GHS ${available.toFixed(2)}`
  return ''
}

// Paystack transfer references: 16-50 characters, lowercase letters, digits, "-" and "_".
export function transferReference(withdrawalId: string): string {
  return `borla-wd-${withdrawalId.toLowerCase()}`
}
