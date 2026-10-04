// F6: staff role lists never include customers or drivers.
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(name) ? [full] : []
  })
}

// The only role lists allowed to name CUSTOMER or DRIVER.
const SELF_SERVICE_LISTS = new Set(['SELF_SERVICE_ROLES'])

const lists = ['lib', 'app'].flatMap((d) => sourceFiles(path.join(ROOT, d))).flatMap((file) => {
  const src = readFileSync(file, 'utf8')
  return [...src.matchAll(/const ([A-Z_]*ROLES)[^=]*=\s*\[([^\]]*)\]/g)].map((m) => ({
    file: path.relative(ROOT, file),
    name: m[1],
    body: m[2],
  }))
})

describe('role lists', () => {
  it('finds the role lists', () => {
    expect(lists.length).toBeGreaterThan(15)
  })

  for (const l of lists.filter((x) => !SELF_SERVICE_LISTS.has(x.name))) {
    it(`${l.name} (${l.file}) has no customer or driver`, () => {
      expect(l.body).not.toMatch(/'CUSTOMER'|'DRIVER'/)
    })
  }

  it('money roles stay narrow', async () => {
    const { PAYOUT_ROLES } = await import('@/lib/wallet-server')
    const { REFUND_ROLES } = await import('@/lib/refunds')
    expect([...PAYOUT_ROLES].sort()).toEqual(['FINANCE', 'SUPER_ADMIN'])
    expect([...REFUND_ROLES].sort()).toEqual(['FINANCE', 'OPS_MANAGER', 'SUPER_ADMIN'])
  })

  it('only Super Admins manage staff', async () => {
    const { STAFF_ADMIN_ROLES } = await import('@/lib/staff')
    expect(STAFF_ADMIN_ROLES).toEqual(['SUPER_ADMIN'])
  })
})
