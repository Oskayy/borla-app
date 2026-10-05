// Changing vehicle after approval: the change waits for ops, and the current vehicle keeps working until then.
import { describe, expect, it } from 'vitest'
import { approvedRadius, planVehicleChange, vehicleChangeStage } from '@/lib/vehicle-change'

const base = { currentVehicleId: 'tricycle', requestedRadiusKm: 8, currentMaxRadiusKm: 5 }

describe('vehicle change', () => {
  it('drivers not approved yet change straight away', () => {
    expect(planVehicleChange({ ...base, approved: false, requestedVehicleId: 'car' })).toEqual({ kind: 'direct' })
    expect(planVehicleChange({ ...base, approved: true, currentVehicleId: null, requestedVehicleId: 'car' })).toEqual({ kind: 'direct' })
  })

  it('approved drivers wait for ops, with their radius kept within the current vehicle', () => {
    expect(planVehicleChange({ ...base, approved: true, requestedVehicleId: 'car' })).toEqual({ kind: 'pending', currentRadiusKm: 5 })
    expect(planVehicleChange({ ...base, approved: true, requestedVehicleId: 'car', requestedRadiusKm: 3 })).toEqual({ kind: 'pending', currentRadiusKm: 3 })
  })

  it('choosing the same vehicle is not a change', () => {
    expect(planVehicleChange({ ...base, approved: true, requestedVehicleId: 'tricycle' })).toEqual({ kind: 'same' })
  })

  it('tells the driver where the change stands', () => {
    const p = { pendingVehicleTypeId: 'car', pendingVehicleAt: null, vehicleChangeNote: null, hasPhoto: false }
    expect(vehicleChangeStage(p)).toBe('needs_photo')
    expect(vehicleChangeStage({ ...p, hasPhoto: true })).toBe('ready_to_send')
    expect(vehicleChangeStage({ ...p, hasPhoto: true, pendingVehicleAt: new Date() })).toBe('waiting')
    expect(vehicleChangeStage({ ...p, pendingVehicleTypeId: null, vehicleChangeNote: 'Blurry photo' })).toBe('sent_back')
    expect(vehicleChangeStage({ ...p, pendingVehicleTypeId: null })).toBe('none')
  })

  it('on approval uses the radius asked for, within the new vehicle limit', () => {
    expect(approvedRadius(8, 5, 10, 6)).toBe(8)
    expect(approvedRadius(12, 5, 10, 6)).toBe(10)
    expect(approvedRadius(null, 5, 10, 6)).toBe(5)
    expect(approvedRadius(null, null, 10, 6)).toBe(6)
  })
})
