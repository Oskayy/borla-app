import { describe, expect, it } from 'vitest'
import { distanceKm, parseFuel, roundPoint, shiftHours, summarizeNightWeather, weatherLine } from '@/lib/driver-tips'
import { DEFAULT_SHIFT_SETTINGS } from '@/lib/shift'

describe('shiftHours', () => {
  it('covers 8pm to 6am across midnight', () => {
    const h = shiftHours('2026-10-14', DEFAULT_SHIFT_SETTINGS)
    expect(h[0]).toBe('2026-10-14T20:00')
    expect(h).toContain('2026-10-14T23:00')
    expect(h).toContain('2026-10-15T00:00')
    expect(h[h.length - 1]).toBe('2026-10-15T05:00')
    expect(h).toHaveLength(10)
  })
})

describe('summarizeNightWeather', () => {
  const hours = shiftHours('2026-10-14', DEFAULT_SHIFT_SETTINGS)
  const hourly = {
    time: ['2026-10-14T19:00', '2026-10-14T20:00', '2026-10-14T23:00', '2026-10-15T01:00', '2026-10-15T07:00'],
    temperature_2m: [31, 28.4, 26.2, 25.1, 30],
    precipitation_probability: [90, 10, 30, 70, 95],
  }
  it('only reads the shift hours', () => {
    expect(summarizeNightWeather(hourly, hours)).toEqual({ minC: 25, maxC: 28, rainChance: 70, rainFrom: '1:00am' })
  })
  it('gives nothing without data', () => {
    expect(summarizeNightWeather(undefined, hours)).toBeNull()
    expect(summarizeNightWeather({ time: ['2026-10-16T01:00'], temperature_2m: [20] }, hours)).toBeNull()
  })
  it('reads as a sentence', () => {
    expect(weatherLine({ minC: 25, maxC: 28, rainChance: 70, rainFrom: '1:00am' })).toBe(
      '25–28°C. Rain likely from about 1:00am (70%): pack a raincoat and drive carefully.'
    )
    expect(weatherLine({ minC: 26, maxC: 26, rainChance: 5, rainFrom: null })).toBe('26°C and dry.')
  })
})

describe('fuel stations', () => {
  const from = { lat: 5.67, lng: -0.01 }
  it('sorts by distance, names unnamed ones, skips ones with no position', () => {
    const list = parseFuel(
      {
        elements: [
          { lat: 5.7, lon: -0.01, tags: { brand: 'Shell' } },
          { center: { lat: 5.671, lon: -0.011 }, tags: { name: 'Total Comm. 4' } },
          { tags: { name: 'Nowhere' } },
          { lat: 5.68, lon: -0.02 },
        ],
      },
      from
    )
    expect(list.map((s) => s.name)).toEqual(['Total Comm. 4', 'Fuel station', 'Shell'])
    expect(list[0].km).toBeLessThan(0.3)
  })
  it('never sends an exact position', () => {
    expect(roundPoint({ lat: 5.67891, lng: -0.01234 }, 2)).toEqual({ lat: 5.68, lng: -0.01 })
    expect(roundPoint({ lat: 5.67891, lng: -0.01234 }, 1)).toEqual({ lat: 5.7, lng: -0 })
  })
  it('measures distance in km', () => {
    expect(distanceKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.2, 0)
  })
})
