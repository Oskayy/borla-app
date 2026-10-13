// When a driver may delete their account (decided Oct 2026). Pure so it can be tested.
// Nothing may be left in between: no stops on their list, no payout on its way, no money still owed either way.
// (Earnings must be paid out first, and a debt to Trashit must be settled first.)

import type { WalletState } from './earnings'

export interface DriverDeleteState {
  openStops: number // stops assigned, collected or waiting for an unload check
  openWithdrawals: number // payouts requested, being sent or waiting to be confirmed
  wallet: WalletState // pesewas
}

const ghs = (p: number) => `GHS ${(p / 100).toFixed(2)}`

// The reasons deletion is refused right now, in the order to deal with them ([] = it can go ahead).
export function driverDeleteBlockers(s: DriverDeleteState, accraDate: (d: Date) => string): string[] {
  const out: string[] = []
  if (s.openStops > 0) {
    out.push(`You have ${s.openStops === 1 ? 'a stop' : `${s.openStops} stops`} on your list. Finish ${s.openStops === 1 ? 'it' : 'them'}, or ask Trashit to take ${s.openStops === 1 ? 'it' : 'them'} off.`)
  }
  if (s.openWithdrawals > 0) out.push('A payout to you is on its way. Wait until it has arrived.')
  if (s.wallet.owed > 0) out.push(`You owe Trashit ${ghs(s.wallet.owed)} (pay taken back after a refund). Contact Trashit to settle it first.`)
  if (s.wallet.available > 0) out.push(`Cash out your ${ghs(s.wallet.available)} first (Earnings).`)
  if (s.wallet.clearing > 0) {
    out.push(
      s.wallet.nextClearAt
        ? `${ghs(s.wallet.clearing)} is still clearing. It becomes available from ${accraDate(s.wallet.nextClearAt)}; cash it out then.`
        : `${ghs(s.wallet.clearing)} is still being checked by Trashit (a load not yet confirmed as unloaded). Contact Trashit.`
    )
  }
  if (s.wallet.reserve > 0) out.push(`${ghs(s.wallet.reserve)} is kept back during your first 30 days. It's released after that; cash it out then.`)
  return out
}
