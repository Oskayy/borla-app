import { cleanText, isValidLat, isValidLng } from './validate'
import { inRange } from './numbers'

export const SITE_STATUSES = ['OPEN', 'CLOSED', 'FULL'] as const
export type SiteStatus = (typeof SITE_STATUSES)[number]
export const SITE_WASTE_TYPES = ['general', 'recyclable', 'hazardous'] as const

// Senior ops edit a site's details; any dispatcher can switch its status during a shift.
export const SITE_EDIT_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER']
export const SITE_STATUS_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER', 'DISPATCHER']

export interface SiteHours {
  open24Hours: boolean
  opensAtMinutes: number | null
  closesAtMinutes: number | null
}

// Is the site open at this local time (minutes after midnight)? Handles hours that run past midnight.
export function isOpenAt(site: SiteHours, minutes: number): boolean {
  if (site.open24Hours) return true
  const open = site.opensAtMinutes
  const close = site.closesAtMinutes
  if (open == null || close == null) return false
  if (open === close) return true // treated as all day
  if (open < close) return minutes >= open && minutes < close // e.g. 06:00-18:00
  return minutes >= open || minutes < close // overnight, e.g. 19:00-05:00
}

// Does the site stay open for the whole shift (e.g. 20:00-06:00)?
export function coversShift(site: SiteHours, shiftStart: number, shiftEnd: number): boolean {
  if (site.open24Hours) return true
  const shiftLength = (shiftEnd - shiftStart + 1440) % 1440
  for (let t = 0; t < shiftLength; t += 15) {
    if (!isOpenAt(site, (shiftStart + t) % 1440)) return false
  }
  return true
}

export interface SiteInput {
  name: string
  address: string | null
  lat: number
  lng: number
  geofenceRadiusM: number
  open24Hours: boolean
  opensAtMinutes: number | null
  closesAtMinutes: number | null
  acceptedWaste: string[]
  avgUnloadMinutes: number
  notes: string | null
  zoneId: string | null
  active: boolean
}

function clockToMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

// Returns clean site details, or an error message.
export function parseSiteBody(body: any): { ok: boolean; error: string; data: SiteInput } {
  const bad = (error: string) => ({ ok: false, error, data: null as unknown as SiteInput })

  const name = cleanText(body?.name, 80)
  if (!name) return bad('Please enter a site name')

  const address = body?.address ? cleanText(body.address, 200) : null
  if (body?.address && !address) return bad('The address is too long')

  const lat = typeof body?.lat === 'string' ? Number(body.lat) : body?.lat
  const lng = typeof body?.lng === 'string' ? Number(body.lng) : body?.lng
  if (!isValidLat(lat) || !isValidLng(lng)) return bad('Please place the site on the map')

  const geofence = inRange(body?.geofenceRadiusM, 30, 1000)
  if (geofence === null || !Number.isInteger(geofence)) return bad('The geofence must be a whole number from 30 to 1,000 metres')

  const open24Hours = body?.open24Hours !== false
  let opensAtMinutes: number | null = null
  let closesAtMinutes: number | null = null
  if (!open24Hours) {
    opensAtMinutes = clockToMinutes(body?.opensAt)
    closesAtMinutes = clockToMinutes(body?.closesAt)
    if (opensAtMinutes === null || closesAtMinutes === null) return bad('Please enter opening and closing times as HH:MM')
  }

  const rawWaste = Array.isArray(body?.acceptedWaste) ? body.acceptedWaste : []
  const acceptedWaste = SITE_WASTE_TYPES.filter((w) => rawWaste.includes(w))
  if (acceptedWaste.length === 0) return bad('Please tick at least one type of waste the site accepts')

  const unload = inRange(body?.avgUnloadMinutes, 1, 240)
  if (unload === null || !Number.isInteger(unload)) return bad('Average unload time must be 1 to 240 minutes')

  const notes = body?.notes ? cleanText(body.notes, 500) : null
  if (body?.notes && !notes) return bad('Notes are too long')

  const zoneId = typeof body?.zoneId === 'string' && body.zoneId ? body.zoneId : null
  const active = body?.active !== false

  return {
    ok: true,
    error: '',
    data: {
      name,
      address,
      lat,
      lng,
      geofenceRadiusM: geofence,
      open24Hours,
      opensAtMinutes,
      closesAtMinutes,
      acceptedWaste: [...acceptedWaste],
      avgUnloadMinutes: unload,
      notes,
      zoneId,
      active,
    },
  }
}

export function describeHours(site: SiteHours): string {
  if (site.open24Hours) return 'Open 24 hours'
  const fmt = (m: number | null) =>
    m == null ? '?' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  return `${fmt(site.opensAtMinutes)} – ${fmt(site.closesAtMinutes)}`
}