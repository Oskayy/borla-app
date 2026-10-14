// How an order's status reads to the customer. The database has many internal steps; customers see four stages
// (Booked, Driver assigned, Collected, Done) plus a plain sentence about what happens next.

export const CUSTOMER_STAGES = ['Booked', 'Driver assigned', 'Collected', 'Done'] as const

// Status colours (same in every app): waiting = blue, waiting on Trashit; progress = amber, on the way;
// done = green with a tick; problem = red, needs someone.
export type StatusTone = 'neutral' | 'waiting' | 'progress' | 'done' | 'problem'

export interface CustomerStatus {
  label: string // short pill text
  message: string // one sentence: what is happening / what happens next
  stage: number // index into CUSTOMER_STAGES that is complete (-1 = not booked yet)
  tone: StatusTone
  active: boolean // still on its way (shows on the home screen as the active pickup)
}

const S: Record<string, CustomerStatus> = {
  DRAFT: { label: 'Not paid', message: 'This booking is not paid yet, so it is not scheduled.', stage: -1, tone: 'neutral', active: false },
  PENDING_PAYMENT: { label: 'Paying', message: 'We are waiting for your payment to be confirmed.', stage: -1, tone: 'neutral', active: true },
  PAID: { label: 'Booked', message: 'Payment received. Your pickup is scheduled.', stage: 0, tone: 'waiting', active: true },
  READY_FOR_BATCH: { label: 'Booked', message: 'Payment received. Your pickup is scheduled.', stage: 0, tone: 'waiting', active: true },
  ASSIGNED: { label: 'Driver assigned', message: 'A driver has your stop for the night. Put your bins out before 8pm.', stage: 1, tone: 'progress', active: true },
  EN_ROUTE: { label: 'On the way', message: 'Your driver is on the way.', stage: 1, tone: 'progress', active: true },
  ARRIVED: { label: 'Driver at gate', message: 'Your driver is at your gate.', stage: 1, tone: 'progress', active: true },
  PICKUP_PENDING_REVIEW: { label: 'Collected', message: 'Your bins were collected and are being checked.', stage: 2, tone: 'waiting', active: true },
  PICKED_UP: { label: 'Collected', message: 'Your bins were collected and are on the way to a disposal site.', stage: 2, tone: 'waiting', active: true },
  DISPOSAL_PENDING: { label: 'Collected', message: 'Your bins were collected and are being unloaded at a disposal site.', stage: 2, tone: 'waiting', active: true },
  DISPOSAL_VERIFIED: { label: 'Done', message: 'Unloaded at a licensed disposal site. All done.', stage: 3, tone: 'done', active: false },
  COMPLETED: { label: 'Done', message: 'Unloaded at a licensed disposal site. All done.', stage: 3, tone: 'done', active: false },
  CANCELLED: { label: 'Cancelled', message: 'This pickup was cancelled.', stage: -1, tone: 'neutral', active: false },
  FAILED_PICKUP: { label: 'Missed', message: 'The driver could not collect this pickup. Support will follow up.', stage: 1, tone: 'problem', active: false },
  DISPUTED: { label: 'Under review', message: 'There is an open issue with this pickup. Support will follow up.', stage: 2, tone: 'problem', active: false },
}

export function customerStatus(status: string): CustomerStatus {
  return S[status] ?? { label: status, message: '', stage: -1, tone: 'neutral', active: false }
}

// Pill colours by tone (classes from the design system).
export const TONE_PILL: Record<StatusTone, string> = {
  neutral: 'bg-canvas text-ink-2 ring-line-strong',
  waiting: 'bg-info-wash text-info ring-info/25',
  progress: 'bg-warn-wash text-warn-deep ring-warn/35',
  done: 'bg-ok-wash text-ok-deep ring-ok/30',
  problem: 'bg-danger-wash text-danger ring-danger/25',
}

export interface OrderSnapshot {
  price?: number
  address?: string
  zoneName?: string
  lines?: { code: string; label: string; count: number; litres?: number }[]
}

export function binsText(q: OrderSnapshot | null): string {
  return q?.lines?.filter((l) => l.count > 0).map((l) => `${l.count} × ${l.litres ? `${l.litres} L` : l.label}`).join(', ') ?? ''
}

export function ghs(amount: number | null | undefined): string {
  return `GHS ${(amount ?? 0).toFixed(2)}`
}
