'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { MapRoute } from '@/components/ops/AssignMap'

const AssignMap = dynamic(() => import('@/components/ops/AssignMap'), {
  ssr: false,
  loading: () => <div className="h-full min-h-[420px] animate-pulse rounded-card bg-line/60" />,
})

// The map of tonight's assigned routes on its own (when nothing is waiting to be planned), with a driver list.
export default function TonightMap({ routes }: { routes: MapRoute[] }) {
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <ul className="grid gap-2">
        {routes.map((r) => {
          const stops = r.points.filter((p) => p.kind === 'stop').length
          const on = selected === r.driverId
          return (
            <li key={r.driverId}>
              <button
                type="button"
                onClick={() => setSelected(on ? null : r.driverId)}
                aria-pressed={on}
                className={`press flex w-full items-center gap-3 rounded-card bg-surface p-3.5 text-left transition ${on ? 'ring-2 ring-warn' : 'ring-1 ring-line hover:ring-line-strong'}`}
              >
                <span className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold ${on ? 'bg-warn text-hero' : 'bg-hero text-white'}`}>{r.initials}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{r.name}</span>
                  <span className="block text-sm text-ink-3">
                    {stops} {stops === 1 ? 'stop' : 'stops'} left{!r.start && ' · no position yet'}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="h-[60vh] lg:sticky lg:top-24 lg:h-[calc(100dvh-10rem)]">
        <AssignMap routes={routes} unassigned={[]} selected={selected} onSelect={setSelected} />
      </div>
    </div>
  )
}
