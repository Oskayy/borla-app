/// Driver approval: the documents a driver uploads, and who can review them.
import type { UserRole } from '@prisma/client'

export const DRIVER_DOCS_BUCKET = 'driver-documents' // private: only the server can read or write
export const MAX_DOC_BYTES = 5 * 1024 * 1024 // 5 MB (photos are shrunk on the phone first)
export const APPROVAL_ROLES: UserRole[] = ['SUPER_ADMIN', 'OPS_MANAGER', 'COMPLIANCE']

// The Ghana Card is not photographed: drivers type its number (lib/ghana-card.ts), and their plate number too.
// `setup` documents are added on the profile setup page (vehicle photo); the rest on the verification page.
export const DOC_TYPES: { code: string; label: string; hint: string; required: boolean; setup?: boolean }[] = [
  { code: 'profile_photo', label: 'Photo of you', hint: 'Your face, clearly visible, no sunglasses', required: true },
  { code: 'vehicle_photo', label: 'Your vehicle', hint: 'The whole vehicle, clearly visible', required: true, setup: true },
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
