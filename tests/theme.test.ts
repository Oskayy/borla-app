// Dark mode is chosen per app (website, customer, driver, ops) and saved per account.
import { describe, expect, it } from 'vitest'
import { appForPath, parseThemePrefs } from '@/lib/theme'

describe('appForPath', () => {
  it('knows which app a page belongs to', () => {
    expect(appForPath('/')).toBe('site')
    expect(appForPath('/login')).toBe('site')
    expect(appForPath('/dashboard/customer/book')).toBe('customer')
    expect(appForPath('/dashboard/driver/tonight')).toBe('driver')
    expect(appForPath('/ops/payouts')).toBe('ops')
    expect(appForPath('/account/security')).toBe('ops')
  })
})

describe('parseThemePrefs', () => {
  it('keeps only known apps and themes', () => {
    expect(parseThemePrefs({ customer: 'dark', driver: 'light', ops: 'blue', other: 'dark' })).toEqual({ customer: 'dark', driver: 'light' })
    expect(parseThemePrefs(null)).toEqual({})
    expect(parseThemePrefs('dark')).toEqual({})
  })
})
