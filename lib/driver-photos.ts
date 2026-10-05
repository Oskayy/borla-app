// Signed links (30 min) to a driver's own photos in the private driver-documents bucket.
// Returns null when there is no photo, or storage can't be reached.

import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase-admin'
import { DRIVER_DOCS_BUCKET } from '@/lib/driver-docs'

export const AVATAR_DOC = 'avatar' // the driver's profile picture (not a verification document)

export async function driverPhotoUrls(driverId: string, types: string[]): Promise<Record<string, string | null>> {
  const docs = await prisma.driverDocument.findMany({
    where: { driverId, type: { in: types } },
    orderBy: { createdAt: 'desc' },
    select: { type: true, path: true },
  })
  const out: Record<string, string | null> = Object.fromEntries(types.map((t) => [t, null]))
  if (docs.length === 0) return out
  try {
    const storage = createAdminClient().storage.from(DRIVER_DOCS_BUCKET)
    for (const t of types) {
      const doc = docs.find((d) => d.type === t)
      if (doc) out[t] = (await storage.createSignedUrl(doc.path, 60 * 30)).data?.signedUrl ?? null
    }
  } catch (e) {
    console.error('[driver-photos] could not sign links', e)
  }
  return out
}
