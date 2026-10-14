'use client'

import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import Skeleton from '@/components/kit/Skeleton'

// Shown while a page loads: shapes where the heading, tiles and rows will be, with a soft light sweeping across.
export function PageSkeleton({ tiles = 3, rows = 4 }: { tiles?: number; rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="anim-fade">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      {tiles > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {Array.from({ length: tiles }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-card" />
          ))}
        </div>
      )}
      <div className="mt-6 divide-y divide-line rounded-card bg-surface ring-1 ring-line">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 p-5">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-2 h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  )
}

// Shown when a page couldn't load (usually a slow connection to the database): try again, or go back home.
export function PageError({ reset, home }: { reset: () => void; home: string }) {
  return (
    <div role="alert" className="mx-auto max-w-md rounded-card bg-surface p-6 text-center ring-1 ring-line">
      <p className="text-lg font-semibold">This page didn&apos;t load</p>
      <p className="mt-1 text-[15px] text-ink-2">The connection was slow. Nothing you did was lost.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        <button
          type="button"
          onClick={reset}
          className="press inline-flex min-h-11 items-center gap-2 rounded-full bg-action px-5 font-semibold text-on-action shadow-card"
        >
          <RefreshCw aria-hidden className="size-4" /> Try again
        </button>
        <Link href={home} className="press inline-flex min-h-11 items-center rounded-full px-4 font-semibold text-ink ring-1 ring-line-strong hover:bg-canvas">
          Go home
        </Link>
      </div>
    </div>
  )
}
