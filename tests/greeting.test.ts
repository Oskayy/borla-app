// Greetings use the person's first real name, never a title or a placeholder word.
import { describe, expect, it } from 'vitest'
import { firstNameOf } from '@/lib/format'

describe('firstNameOf', () => {
  it('takes the first name', () => {
    expect(firstNameOf('Ama Mensah')).toBe('Ama')
    expect(firstNameOf('  kwame   asante ')).toBe('Kwame')
  })

  it('skips titles and placeholder words', () => {
    expect(firstNameOf('Mr. Kofi Boateng')).toBe('Kofi')
    expect(firstNameOf('Dr Efua')).toBe('Efua')
    expect(firstNameOf('Test Customer Abena')).toBe('Abena')
    expect(firstNameOf('Driver 2 Yaw')).toBe('Yaw')
  })

  it('is empty when there is no usable name', () => {
    expect(firstNameOf('Customer')).toBe('')
    expect(firstNameOf('Test Driver')).toBe('')
    expect(firstNameOf('')).toBe('')
    expect(firstNameOf(null)).toBe('')
  })
})
