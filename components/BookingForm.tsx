'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { AlertCircle, Check, Home as HomeIcon, Lock, MapPin, MapPinOff, Minus, Moon, Plus, Recycle, Trash2 } from 'lucide-react'
import PhotoCapture from '@/components/PhotoCapture'
import PinPicker from '@/components/PinPicker'
import { BUTTON_PRIMARY, BUTTON_QUIET, Card, FIELD, PageHeader } from '@/components/customer/ui'

interface BinSizeOption {
  code: string
  label: string
  litres: number
}

interface QuoteLine {
  code: string
  label: string
  litres: number
  count: number
  lineTotal: number
}

interface Quote {
  price: number
  zoneName: string
  lines: QuoteLine[]
  totalBins: number
  totalLitres: number
  recyclableDiscount: number
  hazardSurcharge: number
  lateSurcharge: number
  isLate: boolean
  collectionLabel: string
}

const MAX_PER_SIZE = 20

export default function BookingForm({
  sizes,
  home,
  homeNeedsCheck = false,
}: {
  sizes: BinSizeOption[]
  home: { address: string } | null
  homeNeedsCheck?: boolean // a home pin saved before pins had to be confirmed
}) {
  // With a saved home, bookings use it by default. The customer can switch to another address for one order.
  const [useHome, setUseHome] = useState(!!home)
  const [address, setAddress] = useState('')
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null)
  const [wasteType, setWasteType] = useState('general')
  const [hazardous, setHazardous] = useState(false)
  const [bins, setBins] = useState<Record<string, number>>({})
  const [file, setFile] = useState<File | null>(null)
  const [gpsLat, setGpsLat] = useState<number | null>(null)
  const [gpsLng, setGpsLng] = useState<number | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [pendingConfirm, setPendingConfirm] = useState<{
    orderId: string
    distanceMeters: number
    requote: { oldPrice: number; newPrice: number; zoneName: string; collectionLabel: string } | null
  } | null>(null)

  const supabase = createClient()
  const totalBins = Object.values(bins).reduce((a, b) => a + b, 0)
  const pickupAddress = useHome && home ? home.address : address

  // Any change to the order details makes the old price out of date.
  function changed() {
    setQuote(null)
  }

  function setCount(code: string, next: number) {
    const value = Math.max(0, Math.min(MAX_PER_SIZE, next))
    setBins((prev) => ({ ...prev, [code]: value }))
    changed()
  }

  function orderBody() {
    return useHome
      ? { useHome: true, wasteType, hazardous, bins, gpsLat, gpsLng }
      : { address, pinLat: pin?.lat, pinLng: pin?.lng, wasteType, hazardous, bins, gpsLat, gpsLng }
  }

  async function getQuote() {
    if (!useHome && !address.trim()) {
      setError('Please describe the pickup place, with a landmark')
      return
    }
    if (!useHome && !pin) {
      setError('Please place the pin on the pickup spot on the map')
      return
    }
    if (totalBins < 1) {
      setError('Please choose at least one bin')
      return
    }

    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/pricing/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderBody()),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not get a price')
        return
      }
      setQuote(data)
    } catch {
      setError('Could not reach Trashit. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function payNow(orderId: string) {
    try {
      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Could not start payment')
        setLoading(false)
        return
      }

      window.location.href = data.authorizationUrl
    } catch {
      setError('Something went wrong starting payment. Please try again.')
      setLoading(false)
    }
  }

  async function confirmBooking() {
    if (!useHome && !address.trim()) {
      setError('Please describe the pickup place, with a landmark')
      return
    }
    if (!useHome && !pin) {
      setError('Please place the pin on the pickup spot on the map')
      return
    }
    if (!file) {
      setError('Please add a photo of your waste before continuing')
      return
    }

    setError('')
    setLoading(true)

    const orderRes = await fetch('/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderBody()),
    })
    const orderData = await orderRes.json()

    if (!orderRes.ok) {
      setLoading(false)
      setError(orderData.error || 'Could not create booking')
      return
    }

    const filePath = `${orderData.id}/placement-${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage.from('pickup-evidence').upload(filePath, file)

    if (uploadError) {
      setLoading(false)
      setError('Photo upload failed: ' + uploadError.message)
      return
    }

    const evidenceRes = await fetch('/api/orders/add-evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: orderData.id, photoPath: filePath, type: 'customer_placement', gpsLat, gpsLng }),
    })

    if (!evidenceRes.ok) {
      setLoading(false)
      setError('Order created, but photo could not be saved. Contact support.')
      return
    }

    const evidenceData = await evidenceRes.json()

    if (evidenceData.flagged) {
      setLoading(false)
      setPendingConfirm({
        orderId: orderData.id,
        distanceMeters: evidenceData.distanceMeters,
        requote: evidenceData.requote ?? null,
      })
      return
    }

    await payNow(orderData.id)
  }

  async function confirmAddressAndPay() {
    if (!pendingConfirm) return
    setError('')
    setLoading(true)
    await payNow(pendingConfirm.orderId)
  }

  function goBackAndFixAddress() {
    setPendingConfirm(null)
    setQuote(null)
    setFile(null)
    setGpsLat(null)
    setGpsLng(null)
    setError(
      useHome
        ? 'Please check the pin on your home location page, or choose a different address for this order, then take a new photo.'
        : 'Please move the pin to the pickup spot, then take a new photo and try again.'
    )
  }

  if (pendingConfirm) {
    const rq = pendingConfirm.requote
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="Double-check your address" />
        <Card>
          <p className="flex items-start gap-3 text-[15px] leading-relaxed text-ink">
            <MapPinOff aria-hidden className="mt-0.5 size-5 shrink-0 text-driver-deep" />
            <span>
              Your photo&apos;s location is about <strong>{Math.round(pendingConfirm.distanceMeters)} m</strong> from the
              pickup address (<strong>{pickupAddress}</strong>). This can happen if your phone&apos;s location is briefly
              inaccurate, or if the address doesn&apos;t quite match where you are.
            </span>
          </p>

          {rq && (
            <p className="mt-4 rounded-control bg-driver-wash p-4 text-[15px] text-ink">
              Your photo was taken in <strong>{rq.zoneName}</strong>, where pickups cost more. The price has been updated
              from <strong className="tabular-nums">GHS {rq.oldPrice.toFixed(2)}</strong> to{' '}
              <strong className="tabular-nums">GHS {rq.newPrice.toFixed(2)}</strong>.
            </p>
          )}

          <p className="mt-5 text-[15px] font-semibold">Is {pickupAddress} correct?</p>
          <ErrorText text={error} />
          <div className="mt-5 grid gap-2.5">
            <button onClick={confirmAddressAndPay} disabled={loading} className={BUTTON_PRIMARY}>
              {loading ? 'Opening payment…' : rq ? `Yes, continue and pay GHS ${rq.newPrice.toFixed(2)}` : 'Yes, it is correct. Go to payment'}
            </button>
            <button onClick={goBackAndFixAddress} disabled={loading} className={BUTTON_QUIET}>
              No, let me fix the address
            </button>
          </div>
        </Card>
      </div>
    )
  }

  const label = 'text-sm font-semibold text-ink'
  const optionCard = (on: boolean) =>
    `flex cursor-pointer items-start gap-3 rounded-card border p-4 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ops ${
      on ? 'border-customer bg-customer-wash ring-3 ring-customer/15' : 'border-line-strong bg-surface hover:border-ink-3'
    }`

  return (
    <div>
      <PageHeader title="Book a pickup" lead="Book any time. Collection happens overnight, and you see your collection night before you pay." />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          {/* 1. Where */}
          <Card>
            <h2 className={label}>1. Where should we collect?</h2>
            {home ? (
              <div className="mt-3 grid gap-2.5" role="radiogroup" aria-label="Pickup address">
                <label className={optionCard(useHome)}>
                  <input
                    type="radio"
                    name="where"
                    checked={useHome}
                    onChange={() => {
                      setUseHome(true)
                      changed()
                    }}
                    className="sr-only"
                  />
                  <HomeIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-customer" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">My home</span>
                    <span className="block truncate text-sm text-ink-2">{home.address}</span>
                  </span>
                  <Link href="/dashboard/customer/home-location" className="text-sm font-semibold text-customer-deep hover:underline">
                    Change
                  </Link>
                </label>
                <label className={optionCard(!useHome)}>
                  <input
                    type="radio"
                    name="where"
                    checked={!useHome}
                    onChange={() => {
                      setUseHome(false)
                      changed()
                    }}
                    className="sr-only"
                  />
                  <MapPin aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-2" />
                  <span className="font-semibold">A different place, just for this order</span>
                </label>
              </div>
            ) : homeNeedsCheck ? (
              <p className="mt-3 rounded-control bg-driver-wash p-3.5 text-sm text-ink">
                Drivers go exactly to your pin, so please{' '}
                <Link href="/dashboard/customer/home-location" className="font-semibold text-driver-deep underline underline-offset-2">
                  check your home pin
                </Link>{' '}
                once. Until then, place a pin for this order below.
              </p>
            ) : (
              <p className="mt-3 text-sm text-ink-2">
                Tip:{' '}
                <Link href="/dashboard/customer/home-location" className="font-semibold text-customer-deep hover:underline">
                  save your home pin
                </Link>{' '}
                once and you won&apos;t need to place a pin again.
              </p>
            )}

            {!useHome && (
              <div className="mt-4 grid gap-3">
                <div>
                  <label htmlFor="place" className="text-sm font-medium text-ink-2">
                    Describe the place
                  </label>
                  <input
                    id="place"
                    placeholder="e.g. House 12, blue gate, near Chemu SHS, Tema Comm. 4"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value)
                      changed()
                    }}
                    className={`${FIELD} mt-1.5`}
                  />
                </div>
                <p className="text-sm text-ink-2">Put the pin exactly on the gate where the bins will be. Your driver goes to this pin.</p>
                <div className="overflow-hidden rounded-card ring-1 ring-line">
                  <PinPicker
                    pin={pin}
                    height={280}
                    onPinChange={(p) => {
                      setPin(p)
                      changed()
                    }}
                  />
                </div>
              </div>
            )}
          </Card>

          {/* 2. Bins */}
          <Card>
            <h2 className={label}>2. How many bins?</h2>
            {sizes.length === 0 ? (
              <p className="mt-3 text-sm text-danger">Booking is not available right now. Please try again later.</p>
            ) : (
              <ul className="mt-3 grid grid-cols-3 gap-2 sm:gap-2.5">
                {sizes.map((size) => {
                  const count = bins[size.code] ?? 0
                  return (
                    <li
                      key={size.code}
                      className={`rounded-card border px-1.5 py-3.5 text-center transition sm:p-4 ${count > 0 ? 'border-customer bg-customer-wash' : 'border-line-strong'}`}
                    >
                      <Trash2 aria-hidden className={`mx-auto size-6 ${count > 0 ? 'text-customer' : 'text-ink-3'}`} />
                      <p className="mt-1.5 font-semibold">{size.litres} L</p>
                      <p className="text-xs text-ink-3">{size.label}</p>
                      <div className="mt-3 flex items-center justify-center gap-1.5 sm:gap-3">
                        <button
                          type="button"
                          aria-label={`Remove one ${size.label.toLowerCase()}`}
                          onClick={() => setCount(size.code, count - 1)}
                          disabled={count === 0}
                          className="grid size-10 place-items-center rounded-full bg-surface ring-1 ring-line-strong transition hover:bg-canvas disabled:opacity-40"
                        >
                          <Minus aria-hidden className="size-4" />
                        </button>
                        <span className="min-w-6 text-lg font-bold tabular-nums" aria-live="polite">
                          {count}
                        </span>
                        <button
                          type="button"
                          aria-label={`Add one ${size.label.toLowerCase()}`}
                          onClick={() => setCount(size.code, count + 1)}
                          disabled={count >= MAX_PER_SIZE}
                          className="grid size-10 place-items-center rounded-full bg-customer text-white transition hover:bg-customer-deep disabled:opacity-40"
                        >
                          <Plus aria-hidden className="size-4" />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          {/* 3. What */}
          <Card>
            <h2 className={label}>3. What kind of waste?</h2>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Waste type">
              {[
                { value: 'general', title: 'General waste', text: 'Everyday household rubbish' },
                { value: 'recyclable', title: 'Recyclable', text: 'Separated plastics, cans, paper (discounted)' },
              ].map((w) => (
                <label key={w.value} className={optionCard(wasteType === w.value)}>
                  <input
                    type="radio"
                    name="waste"
                    value={w.value}
                    checked={wasteType === w.value}
                    onChange={() => {
                      setWasteType(w.value)
                      changed()
                    }}
                    className="sr-only"
                  />
                  {w.value === 'recyclable' ? (
                    <Recycle aria-hidden className="mt-0.5 size-5 shrink-0 text-customer" />
                  ) : (
                    <Trash2 aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-2" />
                  )}
                  <span>
                    <span className="block font-semibold">{w.title}</span>
                    <span className="block text-sm text-ink-2">{w.text}</span>
                  </span>
                </label>
              ))}
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-3 text-[15px]">
              <input
                type="checkbox"
                checked={hazardous}
                onChange={(e) => {
                  setHazardous(e.target.checked)
                  changed()
                }}
                className="mt-1 size-4 accent-customer"
              />
              <span>
                Contains hazardous items <span className="text-ink-2">(batteries, chemicals, paint, medical waste). An extra charge applies.</span>
              </span>
            </label>
          </Card>

          {/* 4. Photo */}
          <Card>
            <h2 className={label}>4. Photo of your waste</h2>
            <p className="mt-1 text-sm text-ink-2">Required. It helps your driver know what to expect.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <PhotoCapture
                label={file ? 'Retake photo' : 'Take a photo'}
                buttonClassName={BUTTON_QUIET}
                onCapture={(f, lat, lng) => {
                  setFile(f)
                  setGpsLat(lat)
                  setGpsLng(lng)
                }}
              />
              {file && (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-customer-deep">
                  <Check aria-hidden className="size-4" strokeWidth={3} /> Photo added
                </span>
              )}
            </div>
          </Card>
        </div>

        {/* Price summary */}
        <aside className="lg:sticky lg:top-24">
          <Card>
            <h2 className="text-base font-semibold">Your price</h2>
            {!quote ? (
              <>
                <p className="mt-2 text-sm text-ink-2">
                  {totalBins > 0 ? `${totalBins} bin${totalBins === 1 ? '' : 's'} selected.` : 'Choose your bins, then get your price.'}
                </p>
                <ErrorText text={error} />
                <button onClick={getQuote} disabled={loading || sizes.length === 0} className={`mt-5 w-full ${BUTTON_PRIMARY}`}>
                  {loading ? 'Working out your price…' : 'Get price'}
                </button>
              </>
            ) : (
              <>
                <dl className="mt-3 grid gap-1.5 text-sm">
                  {quote.lines.map((l) => (
                    <div key={l.code} className="flex justify-between gap-3">
                      <dt className="text-ink-2">
                        {l.count} × {l.litres} L
                      </dt>
                      <dd className="tabular-nums">GHS {l.lineTotal.toFixed(2)}</dd>
                    </div>
                  ))}
                  {quote.recyclableDiscount > 0 && (
                    <div className="flex justify-between gap-3 text-customer-deep">
                      <dt>Recyclable discount</dt>
                      <dd className="tabular-nums">− GHS {quote.recyclableDiscount.toFixed(2)}</dd>
                    </div>
                  )}
                  {quote.hazardSurcharge > 0 && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-2">Hazardous items</dt>
                      <dd className="tabular-nums">+ GHS {quote.hazardSurcharge.toFixed(2)}</dd>
                    </div>
                  )}
                  {quote.lateSurcharge > 0 && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-2">Late booking</dt>
                      <dd className="tabular-nums">+ GHS {quote.lateSurcharge.toFixed(2)}</dd>
                    </div>
                  )}
                  <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-3">
                    <dt className="font-semibold">Total</dt>
                    <dd className="text-2xl font-bold tabular-nums tracking-tight">GHS {quote.price.toFixed(2)}</dd>
                  </div>
                </dl>
                <p className="mt-1 text-xs text-ink-3">Area: {quote.zoneName}</p>

                <p className="mt-4 flex items-start gap-2.5 rounded-control bg-ops-wash p-3.5 text-sm">
                  <Moon aria-hidden className="mt-0.5 size-4 shrink-0 text-ops" />
                  <span>
                    <strong className="font-semibold">Collection: {quote.collectionLabel}.</strong> Please put your bins out before the
                    collection starts.
                  </span>
                </p>

                <ErrorText text={error} />
                <button onClick={confirmBooking} disabled={loading} className={`mt-5 w-full ${BUTTON_PRIMARY}`}>
                  {loading ? 'Booking…' : `Book and pay GHS ${quote.price.toFixed(2)}`}
                </button>
                <p className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-ink-3">
                  <Lock aria-hidden className="size-3.5" /> Secure payment with MoMo or card via Paystack
                </p>
              </>
            )}
          </Card>
        </aside>
      </div>
    </div>
  )
}

function ErrorText({ text }: { text: string }) {
  if (!text) return null
  return (
    <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-danger">
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" /> {text}
    </p>
  )
}
