// An approved driver moving their home base or zone. The home base sets where their radius is measured from (who
// they can be offered before the shift) and the zone sets where they count as present (lib/presence.ts), so a move
// waits for ops instead of saving straight away. Small corrections (re-placing the pin on the same house) save now.
// Pure functions so they can be tested.

import { distanceInMeters } from './geo'

export const HOME_MOVE_FREE_M = 300 // a pin moved less than this is a correction, saved at once

export interface HomeChangeInput {
  approved: boolean
  current: { homeLat: number | null; homeLng: number | null; zoneId: string | null }
  requested: { homeLat: number; homeLng: number; zoneId: string | null }
}

// 'now': save straight away (not approved yet, a small correction, nothing changed); 'pending': wait for ops.
export function planHomeChange(x: HomeChangeInput): { kind: 'now' | 'pending'; movedKm: number } {
  const { current: c, requested: r } = x
  const movedKm = c.homeLat == null || c.homeLng == null ? 0 : distanceInMeters(c.homeLat, c.homeLng, r.homeLat, r.homeLng) / 1000
  if (!x.approved || c.homeLat == null) return { kind: 'now', movedKm }
  const zoneChanged = (c.zoneId ?? null) !== (r.zoneId ?? null)
  if (movedKm * 1000 < HOME_MOVE_FREE_M && !zoneChanged) return { kind: 'now', movedKm }
  return { kind: 'pending', movedKm }
}

// The pending zone is stored as text: a zone id, or NO_ZONE for "no zone".
export const NO_ZONE = 'none'
