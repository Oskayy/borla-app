// Paying drivers every morning, and making sure the Paystack balance can cover it (Payment flow rewrite, step 5).
// Pure functions so they can be tested. Amounts in pesewas; times are minutes after midnight, Accra time.

import { TRANSFER_FEE_PESEWAS } from './accounts'

export const TOPUP_CHECK_MINUTES = 7 * 60 // 7am: Finance hears how much to add to the Paystack balance
export const SWEEP_MINUTES = 10 * 60 // 10am: each driver's available balance is paid out (placeholder)
export const SWEEP_MIN_PESEWAS = 2_000 // smaller balances wait for the next day (GHS 20, placeholder)
export const SWEEP_AUTO_MAX_PESEWAS = 100_000 // larger daily payouts wait for Finance to approve (GHS 1,000, placeholder)
export const CASHOUT_AUTO_MAX_PESEWAS = 50_000 // "Cash out now" is sent straight away up to GHS 500 (placeholder)
export const FREE_CASHOUTS_PER_DAY = 1 // later ones the same day pay the GHS 1 transfer fee
export const BUFFER_BPS = 2_000 // keep 20% extra in the Paystack balance (or the biggest recent night, if more)

export interface TopUpCheck {
  due: number // the payouts the sweep will send
  fees: number // Paystack's fee on those transfers
  buffer: number // headroom for cash-outs and late payouts
  needed: number
  topUp: number // what Finance has to add (0 if the balance is enough)
}

// needed = due + transfer fees + buffer; buffer = the larger of 20% of what's due or the biggest night of driver
// pay in the last 14 days. A balance Paystack didn't report counts as nothing (so Finance is told).
export function topUpCheck(args: { due: number; transfers: number; balance: number | null; biggestNight: number }): TopUpCheck {
  const fees = args.transfers * TRANSFER_FEE_PESEWAS
  const buffer = Math.max(Math.ceil((args.due * BUFFER_BPS) / 10_000), args.biggestNight)
  const needed = args.due + fees + buffer
  return { due: args.due, fees, buffer, needed, topUp: Math.max(0, needed - (args.balance ?? 0)) }
}

export interface PayoutCandidate {
  driverId: string
  available: number // pesewas, from the wallet rules (lib/earnings.ts)
  hasWallet: boolean
  openWithdrawal: boolean // one is already waiting or being sent
  walletChangedRecently: boolean // the 24-hour pause after a MoMo wallet change
}

export interface SweepPlan {
  auto: { driverId: string; amount: number }[] // sent at once
  forFinance: { driverId: string; amount: number; why: string }[] // waits on the Withdrawals page
}

// Who the daily sweep pays: everyone with at least the minimum available, a wallet, and nothing already on its way.
// Large payouts and drivers whose wallet just changed wait for Finance.
export function planSweep(candidates: PayoutCandidate[]): SweepPlan {
  const plan: SweepPlan = { auto: [], forFinance: [] }
  for (const c of candidates) {
    if (!c.hasWallet || c.openWithdrawal || c.available < SWEEP_MIN_PESEWAS) continue
    if (c.walletChangedRecently) plan.forFinance.push({ driverId: c.driverId, amount: c.available, why: 'MoMo wallet changed in the last 24 hours' })
    else if (c.available > SWEEP_AUTO_MAX_PESEWAS) {
      plan.forFinance.push({ driverId: c.driverId, amount: c.available, why: `over GHS ${SWEEP_AUTO_MAX_PESEWAS / 100}` })
    } else plan.auto.push({ driverId: c.driverId, amount: c.available })
  }
  return plan
}

export function sweepTotal(plan: SweepPlan): { amount: number; fees: number } {
  const amount = plan.auto.reduce((s, p) => s + p.amount, 0)
  return { amount, fees: plan.auto.length * TRANSFER_FEE_PESEWAS }
}

// The transfer fee the driver pays for a "Cash out now": the first each day is free.
export function cashOutFee(cashOutsToday: number): number {
  return cashOutsToday >= FREE_CASHOUTS_PER_DAY ? TRANSFER_FEE_PESEWAS : 0
}

// Whether a cash-out can be sent straight away rather than waiting for Finance.
export function cashOutIsInstant(amount: number, fee: number, paystackBalance: number | null): boolean {
  return amount <= CASHOUT_AUTO_MAX_PESEWAS && paystackBalance != null && paystackBalance >= amount - fee + TRANSFER_FEE_PESEWAS
}
