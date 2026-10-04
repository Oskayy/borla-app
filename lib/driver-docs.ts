/// Driver approval: the documents a driver uploads, and who can review them.
import type { UserRole } from '@prisma/client'

export const DRIVER_DOCS_BUCKET = 'driver-documents' // private: only the server can read or write
export const MAX_DOC_BYTES = 5 * 1024 * 1024 // 5 MB (photos are shrunk on the phone first)
export const APPROVAL_ROLES: UserRole[] = ['SUPER_ADMIN', 'OPS_MANAGER', 'COMPLIANCE']

export const DOC_TYPES: { code: string; label: string; hint: string; required: boolean }[] = [
  { code: 'ghana_card', label: 'Ghana Card', hint: 'A clear photo of the front of your Ghana Card', required: true },
  { code: 'profile_photo', label: 'Photo of you', hint: 'Your face, clearly visible, no sunglasses', required: true },
  { code: 'vehicle_photo', label: 'Your vehicle', hint: 'The whole vehicle, with the number plate if it has one', required: true },
  { code: 'drivers_licence', label: "Driver's licence", hint: 'If you have one', required: false },
]

export function isDocType(code: unknown): code is string {
  return typeof code === 'string' && DOC_TYPES.some((d) => d.code === code)
}

// Which required documents are still missing.
export function missingDocs(uploaded: string[]): string[] {
  const have = new Set(uploaded)
  return DOC_TYPES.filter((d) => d.required && !have.has(d.code)).map((d) => d.label)
}
