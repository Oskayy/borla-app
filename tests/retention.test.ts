import { describe, expect, it } from 'vitest'
import { daysBefore, filesToRemove, monthsBefore, RETENTION_CLEANUP_ON } from '@/lib/retention'

describe('retention limits', () => {
  it('counts 12 months back by calendar month', () => {
    expect(monthsBefore(new Date('2026-10-13T03:00:00Z'), 12).toISOString()).toBe('2025-10-13T03:00:00.000Z')
  })

  it('counts days back exactly', () => {
    expect(daysBefore(new Date('2026-10-13T00:00:00Z'), 90).toISOString()).toBe('2026-07-15T00:00:00.000Z')
  })

  it('keeps a shared photo file while another order still uses it', () => {
    expect(filesToRemove(['trip/a.jpg', 'trip/a.jpg', 'p/b.jpg', ''], ['trip/a.jpg'])).toEqual(['p/b.jpg'])
  })

  it('is switched on', () => {
    expect(RETENTION_CLEANUP_ON).toBe(true)
  })
})
