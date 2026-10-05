// Changing vehicle type after approval. Pure functions (no database) so they can be tested.
//
// A driver who isn't approved yet just changes their vehicle (ops will see it when they review).
// An approved driver's change waits: they keep working on their current vehicle (its capacity and radius)
// until they send a photo of the new one and ops approve it.

export const VEHICLE_CHANGE_DOC = 'vehicle_change_photo' // driver document type for the new vehicle's photo

export type VehicleChangePlan =
  | { kind: 'direct' } // not approved yet: change straight away
  | { kind: 'same' } // approved, same vehicle as now (cancels any change waiting)
  | { kind: 'pending'; currentRadiusKm: number } // approved, new vehicle waits for ops; radius kept within today's vehicle

export function planVehicleChange(input: {
  approved: boolean
  currentVehicleId: string | null
  requestedVehicleId: string
  requestedRadiusKm: number
  currentMaxRadiusKm: number | null
}): VehicleChangePlan {
  if (!input.approved || !input.currentVehicleId) return { kind: 'direct' }
  if (input.requestedVehicleId === input.currentVehicleId) return { kind: 'same' }
  const cap = input.currentMaxRadiusKm ?? input.requestedRadiusKm
  return { kind: 'pending', currentRadiusKm: Math.min(input.requestedRadiusKm, cap) }
}

// Where a vehicle change stands, for the driver's screen.
export type VehicleChangeStage = 'none' | 'needs_photo' | 'ready_to_send' | 'waiting' | 'sent_back'

export function vehicleChangeStage(p: {
  pendingVehicleTypeId: string | null
  pendingVehicleAt: Date | null
  vehicleChangeNote: string | null
  hasPhoto: boolean
}): VehicleChangeStage {
  if (!p.pendingVehicleTypeId) return p.vehicleChangeNote ? 'sent_back' : 'none'
  if (p.pendingVehicleAt) return 'waiting'
  return p.hasPhoto ? 'ready_to_send' : 'needs_photo'
}

// On approval: the radius asked for, never above the new vehicle's limit.
export function approvedRadius(requested: number | null, current: number | null, newMax: number, newDefault: number): number {
  return Math.min(requested ?? current ?? newDefault, newMax)
}
