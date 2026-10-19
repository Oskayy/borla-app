import Link from 'next/link'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import type { StatusTone } from '@/lib/order-status'
import Chip from '@/components/kit/Chip'
import HeroCard from '@/components/kit/HeroCard'
import ZoneMapCard from '@/components/driver/ZoneMapCard'
import type { MapMarker } from '@/components/kit/Map3D'

export interface HomeTip {
  icon: LucideIcon
  title: string
  text: string
  href?: string
}

export interface DriverHomeViewProps {
  greeting: string // "Good evening, Kwame"
  shiftLabel: string // "8:00pm – 6:00am"
  status: { tone: StatusTone; text: string }
  headline: string // "3 stops waiting for you"
  detail: string | null // "1 trip · up to GHS 41.80", or what to do when there are no stops
  markers: MapMarker[]
  mapTitle: string
  radius: string | null
  stops: number
  tips: HomeTip[]
  outsideTips?: React.ReactNode // weather and fuel, streamed in
}

// The driver's Home, as the design: one greeting, tonight's job as the dark card, one main button,
// then the area map and tips. On a tablet or computer the job and tips fill the left column and the map stays in
// view on the right; on a phone they stack in the order job, map, tips.
export default function DriverHomeView({ greeting, shiftLabel, status, headline, detail, markers, mapTitle, radius, stops, tips, outsideTips }: DriverHomeViewProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-8">
      <div className="anim-stagger grid gap-5 lg:col-start-1 lg:row-start-1">
        <h1 className="text-[clamp(1.85rem,4vw,2.5rem)] font-bold leading-[1.05] tracking-[-0.035em]">{greeting}</h1>

        <HeroCard aria-labelledby="job-title" className="fx-stars grid gap-2 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-on-hero-2">Tonight&apos;s job · shift {shiftLabel}</p>
            <Chip tone={status.tone}>{status.text}</Chip>
          </div>
          <h2 id="job-title" className="text-[clamp(1.5rem,3vw,2rem)] font-bold leading-tight tracking-tight">
            {headline}
          </h2>
          {detail && <p className="text-sm text-on-hero-2">{detail}</p>}
        </HeroCard>

        <Link
          href="/dashboard/driver"
          className="press group flex min-h-16 items-center justify-center gap-2.5 rounded-full bg-action px-6 text-lg font-bold text-on-action shadow-lift transition hover:brightness-110"
        >
          Go to tonight&apos;s job <ArrowRight aria-hidden className="size-5 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      </div>

      <div className="lg:sticky lg:top-28 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <ZoneMapCard markers={markers} title={mapTitle} radius={radius} stops={stops} />
      </div>

      <div className="anim-stagger grid gap-5 lg:col-start-1 lg:row-start-2">
        <section aria-labelledby="tips-title" className="grid gap-2.5">
          <h2 id="tips-title" className="px-0.5 text-sm font-semibold text-ink-3">
            For tonight
          </h2>
          <ul className="grid grid-cols-2 gap-2.5 [&>li:last-child:nth-child(odd)]:col-span-2">
            {outsideTips}
            {tips.map(({ icon: Icon, title, text, href }) => {
              const body = (
                <>
                  <span className="grid size-10 place-items-center rounded-[14px] bg-action-wash text-action-deep">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <span className="mt-3 block text-[15px] font-semibold">{title}</span>
                  <span className="mt-0.5 block text-sm text-ink-2">{text}</span>
                </>
              )
              return (
                <li key={title}>
                  {href ? (
                    <Link href={href} className="lift block h-full rounded-card bg-surface p-3.5 shadow-card ring-1 ring-line/70 sm:p-4">
                      {body}
                    </Link>
                  ) : (
                    <div className="h-full rounded-card bg-surface p-3.5 shadow-card ring-1 ring-line/70 sm:p-4">{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
