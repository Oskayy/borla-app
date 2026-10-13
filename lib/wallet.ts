// Driver withdrawals. Pure functions so they can be tested. Balances are worked out in lib/earnings.ts.

export const MIN_WITHDRAWAL_GHS = 10 // placeholder: smallest amount a driver can withdraw
export const MAX_WITHDRAWAL_GHS = 5000 // placeholder: largest single withdrawal

// Withdrawals still on their way: waiting, being sent, or paid by hand and waiting for a second person
// to confirm it (CONFIRMING). While one is open the driver can't ask for another or change their wallet.
export const OPEN_WITHDRAWAL_STATUSES = ['REQUESTED', 'PROCESSING', 'CONFIRMING']

// Withdrawals that use up balance: open ones, and sent ones.
export const HOLDING_STATUSES = [...OPEN_WITHDRAWAL_STATUSES, 'PAID']

// After a driver replaces their MoMo wallet, withdrawals wait this long, so a stolen phone or password
// can't be used to redirect earnings straight away (the driver is alerted and can contact Trashit).
export const PAYOUT_CHANGE_HOLD_HOURS = 24

// When the hold after a wallet change ends, or null if there is no hold now.
export function payoutHoldEndsAt(changedAt: Date | null | undefined, now: Date): Date | null {
  if (!changedAt) return null
  const ends = new Date(changedAt.getTime() + PAYOUT_CHANGE_HOLD_HOURS * 3600_000)
  return ends.getTime() > now.getTime() ? ends : null
}

export function toPesewas(ghs: number): number {
  return Math.round(ghs * 100)
}

// Checks a withdrawal request. Returns an error message, or '' if it's fine.
export function checkWithdrawal(amount: unknown, available: number): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return 'Please enter an amount'
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return 'Amounts can have at most 2 decimal places'
  // Below the minimum is fine when it is everything left (so a balance can always reach zero, e.g. to close the account).
  const all = toPesewas(amount) === toPesewas(available) && amount > 0
  if (amount < MIN_WITHDRAWAL_GHS && !all) return `The smallest withdrawal is GHS ${MIN_WITHDRAWAL_GHS} (or all of your balance)`
  if (amount > MAX_WITHDRAWAL_GHS) return `The largest single withdrawal is GHS ${MAX_WITHDRAWAL_GHS}`
  if (toPesewas(amount) > toPesewas(available)) return `You can withdraw up to GHS ${available.toFixed(2)}`
  return ''
}

// Paystack transfer references: 16-50 characters, lowercase letters, digits, "-" and "_".
export function transferReference(withdrawalId: string): string {
  return `borla-wd-${withdrawalId.toLowerCase()}`
}
