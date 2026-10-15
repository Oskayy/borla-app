import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { BellRing, Moon, Star, Wallet } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { getShiftSettings } from '@/lib/settings'
import { isDriverAvailable, windowLabel, type ShiftSettings } from '@/lib/shift'
import { planningShiftDate } from '@/lib/schedule'
import { worksNight } from '@/lib/availability'
import { storedSplit } from '@/lib/money-split'
import { summarizeRatings } from '@/lib/ratings'
import { DRIVER_LEDGER_TYPES } from '@/lib/earnings'
import { greeting } from '@/lib/format'
import DriverHomeView, { type HomeTip } from '@/components/driver/DriverHomeView'
import type { MapMarker } from '@/components/kit/Map3D'
import OutsideTips, { OutsideTipsLoading } from '@/components/driver/OutsideTips'

export const dynamic = 'force-dynamic'

// Read outside the component: these use the clock.
function nightOf(s: ShiftSettings) {
  const now = new Date()
  return { now, date: planningShiftDate(now, s), weekAgo: new Date(now.getTime() - 7 * 24 * 3600 * 1000) }
}

// km between two points (good enough for "nearest site").
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r)
  const y = (b.lat - a.lat) * r
  return Math.sqrt(x * x + y * y) * 6371
}

// The driver's Home: tonight's job as the dark card with one main button (Go to tonight's job),
// a 3D map of their area (tonight's stops, where to unload, their home base) and tips from Trashit's own data.
export default async function DriverHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await prisma.driverProfile.findUnique({
    where: { userId: user.id },
    include: { user: { select: { name: true } }, zone: { select: { name: true, centerLat: true, centerLng: true } } },
  })
  if (!profile || !profile.vehicleTypeId || profile.homeLat == null || profile.homeLng == null) redirect('/dashboard/driver/profile-setup')
  if (profile.approvalStatus !== 'APPROVED') redirect('/dashboard/driver/verification')

  const settings = await getShiftSettings()
  const { now, date, weekAgo } = nightOf(settings)
  const home = { lat: profile.homeLat, lng: profile.homeLng }
  // Outside services get the area (zone centre), or a rounded point near home: never the exact home pin.
  const area = profile.zone?.centerLat != null && profile.zone.centerLng != null ? { lat: profile.zone.centerLat, lng: profile.zone.centerLng } : home

  const [orders, earned, stars, sites] = await Promise.all([
    prisma.order.findMany({
      where: { driverId: user.id, status: { in: ['ASSIGNED', 'PICKED_UP', 'DISPOSAL_PENDING'] } },
      select: {
        id: true,
        status: true,
        latitude: true,
        longitude: true,
        driverAcceptedAt: true,
        pricePesewas: true,
        platformFeePesewas: true,
        pickupSharePesewas: true,
        unloadSharePesewas: true,
        feeBps: true,
        pickupBps: true,
        distanceBonusPesewas: true,
        distanceBonusDriverId: true,
        routeStop: { select: { sequence: true, tripNumber: true, route: { select: { trips: { select: { tripNumber: true, facility: { select: { id: true, name: true, lat: true, lng: true } } } } } } } },
      },
      orderBy: [{ routeStop: { route: { createdAt: 'asc' } } }, { routeStop: { sequence: 'asc' } }],
    }),
    prisma.ledgerEntry.findMany({
      where: { driverId: user.id, type: { in: DRIVER_LEDGER_TYPES }, createdAt: { gte: weekAgo } },
      select: { amount: true, amountPesewas: true },
    }),
    prisma.orderRating.findMany({ where: { driverId: user.id }, select: { stars: true } }),
    prisma.facility.findMany({ where: { active: true, lat: { not: null }, lng: { not: null } }, select: { id: true, name: true, lat: true, lng: true } }),
  ])

  const firstName = profile.user.name.split(/\s+/)[0] ?? ''
  const online = isDriverAvailable(profile, now, settings)
  const offTonight = !worksNight(profile, date)

  // Tonight in numbers.
  const toCollect = orders.filter((o) => o.status === 'ASSIGNED')
  const waiting = toCollect.filter((o) => !o.driverAcceptedAt).length
  const trips = new Set(orders.map((o) => `${o.routeStop?.tripNumber ?? 1}`)).size
  const pay = orders.reduce((sum, o) => {
    const s = storedSplit(o)
    const bonus = o.distanceBonusDriverId === user.id ? o.distanceBonusPesewas ?? 0 : 0
    return sum + (s ? s.pool + bonus : 0)
  }, 0)

  // The map: tonight's stops in order, where to unload, and home. With nothing tonight: home and the nearest sites.
  const markers: MapMarker[] = [{ ...home, kind: 'home', label: 'Home base' }]
  let n = 0
  for (const o of orders) {
    n++
    if (o.latitude != null && o.longitude != null) markers.push({ lat: o.latitude, lng: o.longitude, kind: 'stop', label: String(n), done: o.status !== 'ASSIGNED' })
  }
  const tonightSites = new Map<string, { name: string; lat: number; lng: number }>()
  for (const o of orders) {
    const t = o.routeStop?.route.trips.find((x) => x.tripNumber === o.routeStop?.tripNumber)
    const f = t?.facility
    if (f?.lat != null && f.lng != null) tonightSites.set(f.id, { name: f.name, lat: f.lat, lng: f.lng })
  }
  const nearSites =
    tonightSites.size > 0
      ? [...tonightSites.values()]
      : sites
          .map((s) => ({ name: s.name, lat: s.lat!, lng: s.lng! }))
          .sort((a, b) => km(home, a) - km(home, b))
          .slice(0, 2)
  nearSites.forEach((s) => markers.push({ lat: s.lat, lng: s.lng, kind: 'site', label: s.name }))

  const weekPesewas = earned.reduce((s, e) => s + (e.amountPesewas ?? Math.round(e.amount * 100)), 0)
  const rating = summarizeRatings(stars.map((r) => r.stars))
  const tips = [
    { icon: Wallet, title: 'Your last 7 days', text: `GHS ${(weekPesewas / 100).toFixed(2)} earned. See Earnings for what you can cash out.`, href: '/dashboard/driver/earnings' },
    rating.average != null && { icon: Star, title: 'Your rating', text: `${rating.average.toFixed(1)} out of 5 from ${stars.length} ${stars.length === 1 ? 'customer' : 'customers'}.`, href: '/dashboard/driver/performance' },
    offTonight
      ? { icon: Moon, title: "You're off tonight", text: 'Dispatch won’t send you stops. Change it in My nights.', href: '/dashboard/driver/availability' }
      : { icon: BellRing, title: 'Before the shift', text: 'Charge your phone, turn alerts on, and bring gloves and a torch.' },
  ].filter(Boolean) as HomeTip[]

  const status = offTonight ? { tone: 'neutral' as const, text: 'Off tonight' } : waiting > 0 ? { tone: 'progress' as const, text: `${waiting} to accept` } : orders.length > 0 ? { tone: 'done' as const, text: 'Ready' } : { tone: 'neutral' as const, text: online ? 'Online' : 'Offline' }
  const headline =
    orders.length === 0 ? 'No stops yet tonight' : toCollect.length === 0 ? 'All collected. Unload to finish.' : `${toCollect.length} ${toCollect.length === 1 ? 'stop' : 'stops'} waiting for you`

  return (
    <DriverHomeView
      greeting={`${greeting()}, ${firstName}`}
      shiftLabel={windowLabel(settings)}
      status={status}
      headline={headline}
      detail={
        orders.length > 0
          ? [`${trips} ${trips === 1 ? 'trip' : 'trips'}`, pay > 0 ? `up to GHS ${(pay / 100).toFixed(2)}` : null].filter(Boolean).join(' · ')
          : offTonight
            ? null
            : 'Go online when the shift starts and stops near you will come in. We’ll alert you.'
      }
      markers={markers}
      mapTitle={profile.zone ? `Your area · ${profile.zone.name}` : 'Your area'}
      radius={profile.radiusKm ? `${profile.radiusKm} km radius` : null}
      stops={orders.length}
      tips={tips}
      outsideTips={
        <Suspense fallback={<OutsideTipsLoading />}>
          <OutsideTips area={area} shiftDate={date} settings={settings} />
        </Suspense>
      }
    />
  )
}
