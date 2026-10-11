// Ghana Card and number plate entry: drivers type them instead of photographing them.
import { describe, expect, it } from 'vitest'
import { maskGhanaCard, parseGhanaCard, parsePlate } from '@/lib/ghana-card'
import { DOC_TYPES, missingDocs } from '@/lib/driver-docs'

describe('Ghana Card number', () => {
  it('accepts the usual ways people type it', () => {
    expect(parseGhanaCard('GHA-123456789-0')).toBe('GHA-123456789-0')
    expect(parseGhanaCard('gha 123456789 0')).toBe('GHA-123456789-0')
    expect(parseGhanaCard('GHA1234567890')).toBe('GHA-123456789-0')
  })
  it('refuses anything else', () => {
    for (const bad of ['', 'GHA-12345678-0', 'GHB-123456789-0', '123456789', 'GHA-123456789-01', null, 42]) {
      expect(parseGhanaCard(bad)).toBeNull()
    }
  })
  it('masks the middle digits', () => {
    expect(maskGhanaCard('GHA-123456789-0')).toBe('GHA-•••••6789-0')
    expect(maskGhanaCard(null)).toBeNull()
  })
})

describe('number plate', () => {
  it('tidies and accepts Ghana plates', () => {
    expect(parsePlate(' gt  1234-24 ')).toBe('GT 1234-24')
    expect(parsePlate('M-24-GR 5678')).toBe('M-24-GR 5678')
  })
  it('refuses empty or odd entries', () => {
    for (const bad of ['', 'AB', 'NO PLATE', '<script>', null]) expect(parsePlate(bad)).toBeNull()
  })
})

describe('driver documents', () => {
  it('no longer asks for a photo of the Ghana Card', () => {
    expect(DOC_TYPES.some((d) => d.code === 'ghana_card')).toBe(false)
  })
  it('still needs a photo of the driver and the vehicle', () => {
    expect(missingDocs([])).toEqual(['Photo of you', 'Your vehicle'])
    expect(missingDocs(['profile_photo', 'vehicle_photo'])).toEqual([])
  })
})
