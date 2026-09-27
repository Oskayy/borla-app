'use client'

import { useState } from 'react'
import ZoneForm from './ZoneForm'

interface ZoneWithCount {
  id: string
  name: string
  city: string
  centerLat: number | null
  centerLng: number | null
  radiusKm: number
  coveredAreas: string[]
  active: boolean
  _count: { drivers: number; customers: number }
}

export default function ZonesClient({ zones }: { zones: ZoneWithCount[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)

  const editingZone = zones.find((z) => z.id === editingId) ?? null

  return (
    <div>
      <ZoneForm
        editingZone={editingZone}
        onDoneEditing={() => setEditingId(null)}
        otherZones={zones}
      />

      <h2 style={{ fontSize: 16, margin: '24px 0 12px' }}>All Zones</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {zones.length === 0 && (
          <div className="panel"><p>No zones created yet.</p></div>
        )}
        {zones.map((zone) => (
          <div key={zone.id} className="panel" style={{ opacity: zone.active ? 1 : 0.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontWeight: 600 }}>{zone.name} — {zone.city}</span>
                {!zone.active && <span style={{ fontSize: 11, color: '#B3261E', marginLeft: 8 }}>INACTIVE</span>}
              </div>
              <button
                onClick={() => setEditingId(zone.id)}
                style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 4, padding: '4px 10px', fontSize: 12 }}
              >
                Edit
              </button>
            </div>
            <p style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
              {zone._count.drivers} driver(s) · {zone._count.customers} customer(s) · {zone.radiusKm}km radius
              {zone.centerLat != null && ` · Center: ${zone.centerLat.toFixed(4)}, ${zone.centerLng?.toFixed(4)}`}
            </p>
            {zone.coveredAreas.length > 0 && (
              <p style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                Covers: {zone.coveredAreas.join(', ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}