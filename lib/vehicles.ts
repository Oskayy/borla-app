import { cleanText, type JsonBody } from '@/lib/validate'
import { inRange } from '@/lib/numbers'

export const VEHICLE_EDIT_ROLES = ['SUPER_ADMIN', 'OPS_MANAGER']

export interface VehicleInput {
  name: string
  capacityLitres: number
  defaultRadiusKm: number
  maxRadiusKm: number
  active: boolean
}

// Returns clean vehicle details, or an error message.
export function parseVehicleBody(body: JsonBody): { ok: boolean; error: string; data: VehicleInput } {
  const bad = (error: string) => ({ ok: false, error, data: null as unknown as VehicleInput })

  const name = cleanText(body?.name, 60)
  const capacity = inRange(body?.capacityLitres, 50, 50000)
  const defaultRadius = inRange(body?.defaultRadiusKm, 0.5, 50)
  const maxRadius = inRange(body?.maxRadiusKm, 0.5, 50)
  const active = body?.active === undefined ? true : body.active

  if (!name || name.length < 2) return bad('Please enter a vehicle name')
  if (capacity === null || !Number.isInteger(capacity)) return bad('Capacity must be a whole number of litres (50 to 50,000)')
  if (defaultRadius === null || maxRadius === null) return bad('Radius values must be between 0.5 and 50 km')
  if (defaultRadius > maxRadius) return bad('The default radius cannot be more than the maximum radius')
  if (typeof active !== 'boolean') return bad('Invalid active setting')

  return { ok: true, error: '', data: { name, capacityLitres: capacity, defaultRadiusKm: defaultRadius, maxRadiusKm: maxRadius, active } }
}

// "Pickup Truck 2" -> "pickup-truck-2"
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}