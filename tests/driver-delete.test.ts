// Driver account deletion: refused while anything is open or any money is still owed either way.
import { describe, expect, it } from 'vitest'
import { driverDeleteBlockers } from '@/lib/driver-delete'
import { checkWithdrawal } from '@/lib/wallet'
import type { WalletState } from '@/lib/earnings'

const empty: WalletState = { available: 0, clearing: 0, nextClearAt: null, reserve: 0, owed: 0, inFlight: 0, paidOut: 0, earned: 0 }
const day = () => 'Tue 14 Oct'

describe('driver account deletion', () => {
  it('goes ahead when nothing is open and nothing is owed', () => {
    expect(driverDeleteBlockers({ openStops: 0, openWithdrawals: 0, wallet: empty }, day)).toEqual([])
  })
  it('is refused with each reason, in order', () => {
    const r = driverDeleteBlockers(
      { openStops: 2, openWithdrawals: 1, wallet: { ...empty, owed: 500, available: 1000, clearing: 300, nextClearAt: new Date(), reserve: 200 } },
      day
    )
    expect(r).toHaveLength(6)
    expect(r[0]).toMatch(/2 stops/)
    expect(r[2]).toMatch(/owe Trashit GHS 5.00/)
    expect(r[3]).toMatch(/Cash out your GHS 10.00/)
    expect(r[4]).toMatch(/Tue 14 Oct/)
  })
  it('a load never confirmed as unloaded needs Trashit', () => {
    expect(driverDeleteBlockers({ openStops: 0, openWithdrawals: 0, wallet: { ...empty, clearing: 1600 } }, day)[0]).toMatch(/checked by Trashit/)
  })
})

describe('cashing out the last few cedis', () => {
  it('the whole balance can be cashed out even below the GHS 10 minimum', () => {
    expect(checkWithdrawal(4.5, 4.5)).toBe('')
  })
  it('part of a small balance still follows the minimum', () => {
    expect(checkWithdrawal(4, 4.5)).toMatch(/smallest withdrawal/)
  })
})
