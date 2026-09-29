import { createAdminClient } from '@/lib/supabase-admin'

// Public bucket: anyone can view a picture by its link, but only the server (service role key) can upload.
export const VEHICLE_IMAGE_BUCKET = 'vehicle-images'
export const MAX_VEHICLE_IMAGE_BYTES = 2 * 1024 * 1024 // 2 MB

// The drawings that ship with the app, used until a real photo is uploaded.
const PLACEHOLDERS: Record<string, string> = {
  aboboyaa: '/vehicles/aboboyaa.svg',
  'borla-car': '/vehicles/borla-car.svg',
  'tipper-truck': '/vehicles/tipper-truck.svg',
}

export function placeholderFor(code: string): string | null {
  return PLACEHOLDERS[code] ?? null
}

// Works out the real file type from the file's first bytes, rather than trusting its name.
// Only JPEG, PNG and WebP are accepted (no SVG: it can carry scripts).
export function detectImageType(bytes: Uint8Array): { mime: string; ext: string } | null {
  const b = bytes
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' }
  }
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  ) {
    return { mime: 'image/webp', ext: 'webp' }
  }
  return null
}

// If a picture link points at our bucket, returns the file's path inside it (for deleting it later).
export function storedPathFromUrl(url: string | null): string | null {
  if (!url) return null
  const marker = `/storage/v1/object/public/${VEHICLE_IMAGE_BUCKET}/`
  const i = url.indexOf(marker)
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length))
}

// Best effort: an old picture left behind never blocks anything.
export async function deleteStoredVehicleImage(url: string | null) {
  const path = storedPathFromUrl(url)
  if (!path) return
  try {
    await createAdminClient().storage.from(VEHICLE_IMAGE_BUCKET).remove([path])
  } catch (e) {
    console.error('[vehicle-images] could not delete old picture:', e)
  }
}