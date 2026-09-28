import { prisma } from '@/lib/prisma'
import { getShiftSettings } from '@/lib/settings'
import { classifyBooking, describeCollection } from '@/lib/shift'
import { pickZone } from '@/lib/zone-match'
import { geocodeAddress } from '@/lib/geocode'
import {
  calculatePrice,
  type OrderInput,
  type PriceBreakdown,
  type RuleForQuote,
  type ZoneForQuote,
} from '@/lib/pricing-core'

export { parseOrderInput, WASTE_TYPES } from '@/lib/pricing-core'

// Everything stored on an order at booking time, so its price can always be reproduced.
export interface QuoteSnapshot extends PriceBreakdown {
  version: 2
  address?: string
  wasteType: OrderInput['wasteType']
  hazardous: boolean
  bins: Record<string, number>
  bagCount: number // total bins; kept so older screens that read bagCount still work
  isLate: boolean
  shiftDate: string
  collectionLabel: string
  quotedAt: string
  requotedFrom?: { zoneId: string; zoneName: string; price: number }
}

// Same fields whether it worked or not (like lib/auth.ts), so it type-checks with strict mode off.
// Rule of use: if `ok` is false, return `error` with `status` and stop. Only read `quote` after that check.
export interface QuoteResult {
  ok: boolean
  status: number
  error: string
  quote: QuoteSnapshot
  lat: number
  lng: number
}

function fail(status: number, error: string): QuoteResult {
  return { ok: false, status, error, quote: null as unknown as QuoteSnapshot, lat: 0, lng: 0 }
}

export async function getActiveRule(): Promise<RuleForQuote | null> {
  const rule = await prisma.pricingRule.findFirst({
    where: { active: true },
    orderBy: { createdAt: 'desc' },
    include: { binPrices: { include: { binSize: true } } },
  })
  if (!rule) return null
  return {
    id: rule.id,
    name: rule.name,
    baseFee: rule.baseFee,
    volumeRate: rule.volumeRate,
    hazardSurcharge: rule.hazardSurcharge,
    lateSurcharge: rule.lateSurcharge,
    platformFeePercent: rule.platformFeePercent,
    separatedDiscountPercent: rule.separatedDiscountPercent,
    bins: rule.binPrices
      .filter((bp) => bp.binSize.active)
      .map((bp) => ({
        binSizeId: bp.binSizeId,
        code: bp.binSize.code,
        label: bp.binSize.label,
        litres: bp.binSize.litres,
        fee: bp.fee,
      })),
  }
}

export async function findZoneForPoint(lat: number, lng: number) {
  const zones = await prisma.zone.findMany({
    where: { active: true, centerLat: { not: null }, centerLng: { not: null } },
    select: { id: true, name: true, city: true, centerLat: true, centerLng: true, radiusKm: true, priceMultiplier: true },
  })
  return pickZone(zones, lat, lng)
}

// Works out where the pickup is: the typed address first, the photo's GPS as a fallback.
export async function locatePickup(
  address: string,
  gpsLat: number | null,
  gpsLng: number | null
): Promise<{ lat: number; lng: number } | null> {
  const geocoded = await geocodeAddress(address)
  if (geocoded) return geocoded
  if (gpsLat != null && gpsLng != null) return { lat: gpsLat, lng: gpsLng }
  return null
}

// Prices an order for a known zone. Used by the quote, by order creation and by re-quotes.
export async function quoteForZone(
  input: OrderInput,
  zone: ZoneForQuote,
  now: Date = new Date()
): Promise<QuoteResult> {
  const [rule, settings] = await Promise.all([getActiveRule(), getShiftSettings()])
  if (!rule) return fail(500, 'Pricing is not set up yet. Please try again later.')

  const booking = classifyBooking(now, settings)
  const result = calculatePrice(rule, zone, input, booking.isLate)
  if (!result.ok) return fail(400, result.error)

  return {
    ok: true,
    status: 200,
    error: '',
    lat: 0,
    lng: 0,
    quote: {
      version: 2,
      ...result.breakdown,
      wasteType: input.wasteType,
      hazardous: input.hazardous,
      bins: input.bins,
      bagCount: result.breakdown.totalBins,
      isLate: booking.isLate,
      shiftDate: booking.shiftDate,
      collectionLabel: describeCollection(booking.shiftDate, booking.localDate, settings),
      quotedAt: now.toISOString(),
    },
  }
}

// Full quote from an address: locate it, find its zone, price it.
export async function buildQuote(
  input: OrderInput,
  address: string,
  gpsLat: number | null,
  gpsLng: number | null
): Promise<QuoteResult> {
  const point = await locatePickup(address, gpsLat, gpsLng)
  if (!point) {
    return fail(
      400,
      "We couldn't find that address. Try adding a nearby landmark, or take the photo at the pickup spot so we can use your location."
    )
  }

  const zone = await findZoneForPoint(point.lat, point.lng)
  if (!zone) {
    return fail(400, "Sorry, we don't serve this area yet.")
  }

  const priced = await quoteForZone(input, zone)
  if (!priced.ok) return priced
  return { ...priced, quote: { ...priced.quote, address }, lat: point.lat, lng: point.lng }
}