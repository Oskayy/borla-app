// A customer telling Trashit how a pickup went (pure rules; the route is app/api/orders/[id]/report).
//  - After collection: "all good", or a problem (not collected, spilled, damage, something else). A problem opens a
//    dispute, which holds the driver's pay for that order from clearing until ops have dealt with it.
//  - After a "gate locked / bins out of reach" report: the customer can answer it (e.g. "the gate was open").

export const REPORT_WINDOW_HOURS = 72 // after the pickup, a problem can still be reported
export const MAX_REPORT_NOTE = 500

export const PROBLEMS = {
  NOT_COLLECTED: 'Bins not collected (or only some)',
  SPILL: 'Waste spilled or left behind',
  DAMAGE: 'Bin or property damaged',
  OTHER: 'Something else',
} as const
export type ProblemKind = keyof typeof PROBLEMS
export type ReportKind = ProblemKind | 'ALL_GOOD' | 'GATE_REPLY'

const COLLECTED = ['PICKED_UP', 'DISPOSAL_PENDING', 'COMPLETED']

export function parseReport(body: unknown): { ok: true; kind: ReportKind; note: string } | { ok: false; error: string } {
  const b = body as { kind?: unknown; note?: unknown } | null
  const kind = b?.kind
  if (typeof kind !== 'string' || !(kind in PROBLEMS || kind === 'ALL_GOOD' || kind === 'GATE_REPLY')) return { ok: false, error: 'Please choose what happened' }
  const note = typeof b?.note === 'string' ? b.note.replace(/\s+/g, ' ').trim() : ''
  if (note.length > MAX_REPORT_NOTE) return { ok: false, error: `Keep it under ${MAX_REPORT_NOTE} characters` }
  if ((kind === 'OTHER' || kind === 'GATE_REPLY') && note.length < 3) return { ok: false, error: 'Please tell us a little more' }
  return { ok: true, kind: kind as ReportKind, note }
}

// What the customer can do on this order now.
export function reportOptions(order: { status: string }, pickedUpAt: Date | null, now: Date, openReport: boolean): { problems: boolean; gateReply: boolean } {
  if (openReport) return { problems: false, gateReply: false }
  if (order.status === 'FAILED_PICKUP') return { problems: false, gateReply: true }
  if (!COLLECTED.includes(order.status)) return { problems: false, gateReply: false }
  const inWindow = !pickedUpAt || now.getTime() - pickedUpAt.getTime() <= REPORT_WINDOW_HOURS * 3600_000
  return { problems: inWindow, gateReply: false }
}
