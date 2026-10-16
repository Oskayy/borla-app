// Page-speed reports: only well-formed metrics are accepted, and nothing in them points to a person or an order.
import { describe, expect, it } from 'vitest'
import { cleanPath, parseVital } from '@/lib/vitals'

describe('cleanPath', () => {
  it('takes ids, queries and odd characters out of the path', () => {
    expect(cleanPath('/dashboard/customer/orders/3f2a9c1e-1111-4111-8111-111111111111?paid=1')).toBe('/dashboard/customer/orders/:id')
    expect(cleanPath('/ops/drivers/0244123456#x')).toBe('/ops/drivers/:id')
    expect(cleanPath('/')).toBe('/')
    expect(cleanPath('/a/<script>')).toBe('/a/script')
  })
})

describe('parseVital', () => {
  const ok = { name: 'LCP', value: 2345.6, rating: 'good', path: '/dashboard/driver/home', device: 'phone' }
  it('accepts a normal report and rounds it', () => {
    expect(parseVital(ok)).toEqual({ ...ok, value: 2346 })
    expect(parseVital({ ...ok, name: 'CLS', value: 0.12345 })?.value).toBe(0.123)
  })
  it('refuses anything unexpected', () => {
    for (const bad of [null, 'LCP', {}, { ...ok, name: 'FID' }, { ...ok, value: -1 }, { ...ok, value: 1e9 }, { ...ok, value: NaN }, { ...ok, rating: 'great' }, { ...ok, device: 'fridge' }, { ...ok, path: 'https://x.com' }]) {
      expect(parseVital(bad)).toBeNull()
    }
  })
})
