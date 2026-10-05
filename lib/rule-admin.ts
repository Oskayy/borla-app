// Activating and deleting payout and pricing rules from their History lists.
// Exactly one rule of each kind is active (a database index enforces it, migration 20261005200000_one_active_rule).
// The active rule can't be deleted: activate another one first. Orders keep the quote they were given either way.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAdminAction } from '@/lib/admin-log'

export type RuleKind = 'payout' | 'pricing'

export async function activateRule(kind: RuleKind, id: string, actorId: string) {
  const ok = await prisma.$transaction(async (tx) => {
    if (kind === 'payout') {
      const rule = await tx.payoutRule.findUnique({ where: { id }, select: { id: true } })
      if (!rule) return false
      await tx.payoutRule.updateMany({ where: { active: true, NOT: { id } }, data: { active: false } })
      await tx.payoutRule.update({ where: { id }, data: { active: true } })
    } else {
      const rule = await tx.pricingRule.findUnique({ where: { id }, select: { id: true } })
      if (!rule) return false
      await tx.pricingRule.updateMany({ where: { active: true, NOT: { id } }, data: { active: false } })
      await tx.pricingRule.update({ where: { id }, data: { active: true } })
    }
    return true
  })
  if (!ok) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  await logAdminAction(actorId, kind === 'payout' ? 'PAYOUT_RULE_ACTIVATED' : 'PRICING_RULE_ACTIVATED', id, 'Activated from history')
  return NextResponse.json({ success: true })
}

export async function deleteRule(kind: RuleKind, id: string, actorId: string) {
  const rule =
    kind === 'payout'
      ? await prisma.payoutRule.findUnique({ where: { id }, select: { active: true, pickupPercent: true, disposalPercent: true } })
      : await prisma.pricingRule.findUnique({ where: { id }, select: { active: true, name: true } })
  if (!rule) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  if (rule.active) return NextResponse.json({ error: 'This rule is in use. Make another rule active first.' }, { status: 409 })

  if (kind === 'payout') {
    await prisma.payoutRule.delete({ where: { id } })
  } else {
    await prisma.$transaction([prisma.pricingRuleBinPrice.deleteMany({ where: { pricingRuleId: id } }), prisma.pricingRule.delete({ where: { id } })])
  }
  const detail = 'name' in rule ? rule.name : `${rule.pickupPercent}% / ${rule.disposalPercent}%`
  await logAdminAction(actorId, kind === 'payout' ? 'PAYOUT_RULE_DELETED' : 'PRICING_RULE_DELETED', id, detail)
  return NextResponse.json({ success: true })
}
