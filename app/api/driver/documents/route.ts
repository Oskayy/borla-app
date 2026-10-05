import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase-admin'
import { detectImageType } from '@/lib/vehicle-images'
import { DRIVER_DOCS_BUCKET, MAX_DOC_BYTES, isDocType } from '@/lib/driver-docs'
import { VEHICLE_CHANGE_DOC } from '@/lib/vehicle-change'

// A driver uploads one approval document (photo). Stored privately; only staff can view it.
// Approved drivers can only upload the photo of a new vehicle they've asked to change to.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(['DRIVER'])
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'driver_document', maxAttempts: 30, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const profile = await prisma.driverProfile.findUnique({
    where: { userId: auth.user.id },
    select: { approvalStatus: true, pendingVehicleTypeId: true, pendingVehicleAt: true },
  })
  if (!profile) return NextResponse.json({ error: 'Driver profile not found' }, { status: 404 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Please choose a photo' }, { status: 400 })
  }
  const type = form.get('type')
  const file = form.get('file') as File | null
  if (type === VEHICLE_CHANGE_DOC) {
    if (!profile.pendingVehicleTypeId) return NextResponse.json({ error: 'Choose your new vehicle first' }, { status: 409 })
    if (profile.pendingVehicleAt) return NextResponse.json({ error: 'Your vehicle change is already with Trashit for review' }, { status: 409 })
  } else {
    if (!isDocType(type)) return NextResponse.json({ error: 'Invalid document type' }, { status: 400 })
    if (profile.approvalStatus === 'APPROVED') {
      return NextResponse.json({ error: 'Your account is already approved. Contact Trashit to update your documents.' }, { status: 409 })
    }
  }
  if (!file || typeof file.arrayBuffer !== 'function') return NextResponse.json({ error: 'Please choose a photo' }, { status: 400 })
  if (file.size > MAX_DOC_BYTES) return NextResponse.json({ error: 'That photo is too large (max 5 MB).' }, { status: 400 })

  const bytes = new Uint8Array(await file.arrayBuffer())
  const kind = detectImageType(bytes)
  if (!kind) return NextResponse.json({ error: 'Please upload a JPEG, PNG or WebP photo' }, { status: 400 })

  const path = `${auth.user.id}/${type}-${Date.now()}.${kind.ext}`
  const admin = createAdminClient()
  const { error } = await admin.storage.from(DRIVER_DOCS_BUCKET).upload(path, bytes, { contentType: kind.mime, upsert: false })
  if (error) {
    console.error('[driver-docs] upload failed', error)
    return NextResponse.json({ error: 'Could not upload the photo. Please try again.' }, { status: 500 })
  }

  // Keep only the newest file of each type.
  const old = await prisma.driverDocument.findMany({ where: { driverId: auth.user.id, type }, select: { id: true, path: true } })
  await prisma.driverDocument.create({ data: { driverId: auth.user.id, type, path } })
  if (old.length > 0) {
    await prisma.driverDocument.deleteMany({ where: { id: { in: old.map((o: { id: string }) => o.id) } } })
    await admin.storage.from(DRIVER_DOCS_BUCKET).remove(old.map((o: { path: string }) => o.path)).catch(() => {})
  }
  return NextResponse.json({ success: true })
}
