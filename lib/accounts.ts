// Double-entry ledger (Payment flow rewrite, step 4). Pure functions so they can be tested.
//
// Every money event is a journal: two or more postings that add up to zero. Money always leaves one account
// and arrives in another, so nothing appears or vanishes unnoticed, and every report is the sum of an account.
// Amounts are whole pesewas. Sign: a debit is positive, a credit negative. Assets and costs normally have a
// debit (positive) balance; money owed and income have a credit (negative) balance.
// Journals are never edited or deleted (the database refuses); a mistake is fixed by a new correcting journal.

export const ACCOUNTS = {
  paystackClearing: 'paystack_clearing', // asset: customer money Paystack has collected but not yet settled to the bank
  bank: 'bank', // asset: settled money
  paystackBalance: 'paystack_balance', // asset: top-ups used to pay drivers
  customerFundsHeld: 'customer_funds_held', // owed, per order: money paid for jobs not yet finished
  driverPayable: 'driver_payable', // owed, per driver: earned and not yet paid out (clearing + available)
  platformFeeIncome: 'platform_fee_income', // income: Trashit's share of finished jobs
  paymentFees: 'payment_fees', // cost: Paystack's fee on customer payments
  transferFees: 'transfer_fees', // cost: Paystack's fee on driver payouts (after any part the driver paid)
  refundLosses: 'refund_losses', // cost: refunds Trashit covers from its own money
  reconciliationDifferences: 'reconciliation_differences', // a settlement that didn't match what arrived in the bank
} as const

export type Account = (typeof ACCOUNTS)[keyof typeof ACCOUNTS]

export interface Line {
  account: Account
  amount: number // pesewas: debit +, credit -
  orderId?: string | null
  driverId?: string | null
}

// Paystack's fee in Ghana (1.95%) when a payment event doesn't say what it charged. Placeholder.
export const PAYSTACK_FEE_BPS = 195
export const TRANSFER_FEE_PESEWAS = 100 // GHS 1 per MoMo transfer (placeholder; Paystack's price)

export function estimatePaymentFee(pricePesewas: number): number {
  return Math.ceil((pricePesewas * PAYSTACK_FEE_BPS) / 10_000)
}

export function isBalanced(lines: Line[]): boolean {
  return lines.length >= 2 && lines.every((l) => Number.isSafeInteger(l.amount)) && lines.reduce((s, l) => s + l.amount, 0) === 0
}

const drop = (lines: Line[]) => lines.filter((l) => l.amount !== 0)

// Customer pays P: Paystack holds it for us, and it is held for that order until the job is done.
export function paymentLines(orderId: string, price: number): Line[] {
  return [
    { account: ACCOUNTS.paystackClearing, amount: price },
    { account: ACCOUNTS.customerFundsHeld, amount: -price, orderId },
  ]
}

// Paystack keeps its fee out of what it settles to us.
export function paymentFeeLines(orderId: string, fee: number): Line[] {
  return drop([
    { account: ACCOUNTS.paymentFees, amount: fee, orderId },
    { account: ACCOUNTS.paystackClearing, amount: -fee },
  ])
}

// A driver earns a share of an order (pickup, unload, or pay for a wasted trip): it moves from the customer's
// held money to what Trashit owes the driver.
export function earnedLines(orderId: string, driverId: string, amount: number): Line[] {
  return drop([
    { account: ACCOUNTS.customerFundsHeld, amount, orderId },
    { account: ACCOUNTS.driverPayable, amount: -amount, driverId, orderId },
  ])
}

// The job is finished: Trashit's platform fee becomes income (only now, not at payment).
export function feeIncomeLines(orderId: string, fee: number): Line[] {
  return drop([
    { account: ACCOUNTS.customerFundsHeld, amount: fee, orderId },
    { account: ACCOUNTS.platformFeeIncome, amount: -fee, orderId },
  ])
}

export interface RefundAllocation {
  fromUnearned: number // shares nobody has earned yet: simply cancelled
  clawback: number // taken back from the driver (only when they were at fault)
  feeFromHeld: number // the platform fee on this order, not yet counted as income
  feeReversed: number // the platform fee already counted as income, given back
  loss: number // Trashit's own money
}

// Who pays for a refund of R, in this order, until R is covered:
//  1. shares not yet earned on the order (cancelled; nobody loses anything)
//  2. the driver's earned shares, only if the driver was at fault (a clawback)
//  3. the platform fee on the order (not yet income, then income given back)
//  4. Trashit's own funds: a real loss, reported as one
export function allocateRefund(args: {
  refund: number
  held: number // money still held for the order (unearned shares + platform fee not yet income)
  feeNotYetIncome: number // the part of `held` that is the platform fee
  feeIncome: number // platform fee already counted as income on this order (and not yet given back)
  driverEarned: number // what the driver earned on this order, after anything already taken back
  driverAtFault: boolean
}): RefundAllocation {
  let left = args.refund
  const take = (available: number) => {
    const t = Math.max(0, Math.min(left, available))
    left -= t
    return t
  }
  const feeHeld = Math.min(args.feeNotYetIncome, Math.max(0, args.held))
  const fromUnearned = take(Math.max(0, args.held) - feeHeld)
  const clawback = args.driverAtFault ? take(args.driverEarned) : 0
  const feeFromHeld = take(feeHeld)
  const feeReversed = take(args.feeIncome)
  return { fromUnearned, clawback, feeFromHeld, feeReversed, loss: left }
}

// The refund leaves Paystack back to the customer, covered as allocated above.
export function refundLines(orderId: string, driverId: string | null, refund: number, a: RefundAllocation): Line[] {
  return drop([
    { account: ACCOUNTS.customerFundsHeld, amount: a.fromUnearned + a.feeFromHeld, orderId },
    { account: ACCOUNTS.driverPayable, amount: a.clawback, driverId, orderId },
    { account: ACCOUNTS.platformFeeIncome, amount: a.feeReversed, orderId },
    { account: ACCOUNTS.refundLosses, amount: a.loss, orderId },
    { account: ACCOUNTS.paystackClearing, amount: -refund },
  ])
}

// A payout reaches the driver's wallet. `driverFee`: the part of the transfer fee the driver paid (an extra
// cash-out), taken from the amount sent. Manual payouts come from the bank and have no Paystack fee.
export function payoutLines(args: { driverId: string; amount: number; driverFee: number; method: 'paystack' | 'manual' }): Line[] {
  if (args.method === 'manual') {
    return [
      { account: ACCOUNTS.driverPayable, amount: args.amount, driverId: args.driverId },
      { account: ACCOUNTS.bank, amount: -args.amount },
    ]
  }
  const sent = args.amount - args.driverFee
  return drop([
    { account: ACCOUNTS.driverPayable, amount: args.amount, driverId: args.driverId },
    { account: ACCOUNTS.transferFees, amount: TRANSFER_FEE_PESEWAS - args.driverFee },
    { account: ACCOUNTS.paystackBalance, amount: -(sent + TRANSFER_FEE_PESEWAS) },
  ])
}

// Undo a journal (e.g. a payout Paystack reversed after reporting success).
export function reverseLines(lines: Line[]): Line[] {
  return lines.map((l) => ({ ...l, amount: -l.amount }))
}

// Finance moves money from the bank to the Paystack balance (to pay drivers).
export function topUpLines(amount: number): Line[] {
  return [
    { account: ACCOUNTS.paystackBalance, amount },
    { account: ACCOUNTS.bank, amount: -amount },
  ]
}

// A Paystack settlement arrives in the bank. Any difference from what Paystack said it sent is kept apart
// so it shows up until someone explains it.
export function settlementLines(expected: number, received: number): Line[] {
  return drop([
    { account: ACCOUNTS.bank, amount: received },
    { account: ACCOUNTS.reconciliationDifferences, amount: expected - received },
    { account: ACCOUNTS.paystackClearing, amount: -expected },
  ])
}
