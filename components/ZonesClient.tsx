'use client'

import { useState } from 'react'
import ZoneForm from './ZoneForm'
import ZoneMultiplierEditor from './ZoneMultiplierEditor'
import { Pencil } from 'lucide-react'
import { BUTTON_QUIET } from '@/components/ui'
import { AllClear, Chip, SectionTitle } from '@/components/ops/kit'

interface ZoneWithCount {
  id: string
  name: string
  city: string
  centerLat: number | null
  centerLng: number | null
  radiusKm: number
  coveredAreas: string[]
  active: boolean
  priceMultiplier: number
  tier: string
  boundary: unknown
  areaKm2: number | null // size of the drawn outline
  corners: number
  _count: { drivers: number; customers: number }
}

export default function ZonesClient({
  zones,
  canEditZones,
  canEditPrice,
}: {
  zones: ZoneWithCount[]
  canEditZones: boolean
  canEditPrice: boolean
}) {
  const [editingId, setEditingId] = useState<string | null>(null)

  const editingZone = zones.find((z) => z.id === editingId) ?? null

  return (
    <div className="grid gap-8">
      {canEditZones && (
        <ZoneForm key={editingZone?.id ?? 'new'} editingZone={editingZone} onDoneEditing={() => setEditingId(null)} otherZones={zones} />
      )}

      <section aria-labelledby="h-zones">
        <SectionTitle id="h-zones" count={zones.length}>
          All zones
        </SectionTitle>
        {zones.length === 0 ? (
          <AllClear>No zones yet.</AllClear>
        ) : (
          <ul className="divide-y divide-line rounded-card bg-surface shadow-card ring-1 ring-line/70">
            {zones.map((zone) => (
              <li key={zone.id} className={`p-4 sm:px-5 ${zone.active ? '' : 'bg-canvas/60'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{zone.name}</span>
                      <span className="text-ink-3">{zone.city}</span>
                      {!zone.active && <Chip tone="danger">Inactive</Chip>}
                      <Chip tone={zone.tier === 'PREMIUM' ? 'ops' : zone.tier === 'BASIC' ? 'driver' : 'neutral'}>{zone.tier.charAt(0) + zone.tier.slice(1).toLowerCase()}</Chip>
                    </p>
                    <p className="mt-0.5 text-sm text-ink-3">
                      {zone._count.drivers} {zone._count.drivers === 1 ? 'driver' : 'drivers'} · {zone._count.customers}{' '}
                      {zone._count.customers === 1 ? 'customer' : 'customers'}
                      {zone.areaKm2 != null ? ` · ${zone.areaKm2} km² outline, ${zone.corners} corners` : ` · ${zone.radiusKm} km circle (no outline yet)`}
                    </p>
                    {zone.coveredAreas.length > 0 && <p className="mt-0.5 text-sm text-ink-2">Covers {zone.coveredAreas.join(', ')}</p>}
                  </div>
                  {canEditZones && (
                    <button type="button" onClick={() => {
                        setEditingId(zone.id)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }} className={BUTTON_QUIET}>
                      <Pencil aria-hidden className="size-4" /> Edit
                    </button>
                  )}
                </div>
                <ZoneMultiplierEditor zoneId={zone.id} value={zone.priceMultiplier} canEdit={canEditPrice} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
