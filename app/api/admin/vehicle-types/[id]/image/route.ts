import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { enforceRateLimit, tooManyRequests } from '@/lib/rate-limit'
import { isUuid } from '@/lib/validate'
import { logAdminAction } from '@/lib/admin-log'
import { createAdminClient } from '@/lib/supabase-admin'
import { VEHICLE_EDIT_ROLES } from '@/lib/vehicles'
import {
  deleteStoredVehicleImage,
  detectImageType,
  MAX_VEHICLE_IMAGE_BYTES,
  placeholderFor,
  VEHICLE_IMAGE_BUCKET,
} from '@/lib/vehicle-images'

// Uploads a photo for a vehicle type (JPEG, PNG or WebP, up to 2 MB) and replaces the old one.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(VEHICLE_EDIT_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'vehicle_image', maxAttempts: 20, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid vehicle' }, { status: 400 })

  const vehicle = await prisma.vehicleType.findUnique({ where: { id }, select: { name: true, imagePath: true } })
  if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Please choose a picture to upload' }, { status: 400 })
  }

  const file = form.get('file') as File | null
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'Please choose a picture to upload' }, { status: 400 })
  }
  if (file.size > MAX_VEHICLE_IMAGE_BYTES) {
    return NextResponse.json({ error: 'That picture is too large. Please use one under 2 MB.' }, { status: 400 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = detectImageType(bytes)
  if (!type) {
    return NextResponse.json({ error: 'Please upload a JPEG, PNG or WebP picture' }, { status: 400 })
  }

  // A new file name each time, so browsers never show a cached old picture.
  const path = `${id}/${Date.now()}.${type.ext}`
  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from(VEHICLE_IMAGE_BUCKET)
    .upload(path, bytes, { contentType: type.mime, upsert: false, cacheControl: '31536000' })

  if (uploadError) {
    console.error('[vehicle-images] upload failed:', uploadError)
    return NextResponse.json({ error: 'Could not upload the picture. Please try again.' }, { status: 500 })
  }

  const publicUrl = admin.storage.from(VEHICLE_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
  await prisma.vehicleType.update({ where: { id }, data: { imagePath: publicUrl } })
  await deleteStoredVehicleImage(vehicle.imagePath)

  await logAdminAction(auth.user.id, 'VEHICLE_IMAGE_UPLOADED', id, `"${vehicle.name}": ${type.mime}, ${Math.round(file.size / 1024)} KB`)

  return NextResponse.json({ success: true, imagePath: publicUrl })
}

// Removes an uploaded photo and goes back to the placeholder drawing (or no picture).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(VEHICLE_EDIT_ROLES)
  if (!auth.ok) return auth.response

  if (await enforceRateLimit({ identifier: auth.user.id, action: 'vehicle_image', maxAttempts: 20, windowMinutes: 60 })) {
    return tooManyRequests()
  }

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid vehicle' }, { status: 400 })

  const vehicle = await prisma.vehicleType.findUnique({ where: { id }, select: { name: true, code: true, imagePath: true } })
  if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })

  const fallback = placeholderFor(vehicle.code)
  await prisma.vehicleType.update({ where: { id }, data: { imagePath: fallback } })
  await deleteStoredVehicleImage(vehicle.imagePath)

  await logAdminAction(auth.user.id, 'VEHICLE_IMAGE_REMOVED', id, `"${vehicle.name}": back to ${fallback ?? 'no picture'}`)

  return NextResponse.json({ success: true, imagePath: fallback })
}