'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { homeLabel } from '@/lib/home-address'
import { useClientValue } from '@/lib/use-client-value'
import { clearDraft, draftRaw, parseDraft, saveDraft, type BookingDraft } from '@/lib/booking-draft'
import BinIllustration from '@/components/BinIllustration'
import { AlertCircle, ArrowLeft, ArrowRight, Check, Home as HomeIcon, Lock, MapPin, MapPinOff, Minus, Moon, Plus, Recycle, Trash2 } from 'lucide-react'
import PhotoCapture from '@/components/PhotoCapture'
import PhotoPreview from '@/components/kit/PhotoPreview'
import PinPicker from '@/components/PinPicker'
import { FieldError, fieldA11y } from '@/components/FormErrors'
import { BUTTON_PRIMARY, BUTTON_QUIET, Card, FIELD, PageHeader } from '@/components/ui'

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
  taxLines?: { code: string; label: string; percent: number; amount: number }[]
}

const MAX_PER_SIZE = 20

// Which step each field lives on, so an error can take the person back to it.
const FIELD_STEP: Record<string, string> = { place: 'where', pin: 'where', bins: 'bins', photo: 'photo' }

interface BookingFormProps {
  sizes: BinSizeOption[]
  home: { address: string; landmark?: string | null } | null
  homeNeedsCheck?: boolean // a home pin saved before pins had to be confirmed
  acceptHazardous?: boolean // ops setting: off until a disposal site takes hazardous waste
  guest?: boolean // no account yet: price a pickup, then create an account to book it
}

// A pickup priced before signing up (lib/booking-draft.ts) fills the form in, so nobody starts again.
export default function BookingForm(props: BookingFormProps) {
  const raw = useClientValue(draftRaw, '')
  const draft = useMemo(() => parseDraft(raw), [raw])
  return <BookingFormInner key={draft ? 'draft' : 'blank'} {...props} draft={draft} />
}

function BookingFormInner({
  sizes,
  home,
  homeNeedsCheck = false,
  acceptHazardous = false,
  guest = false,
  draft,
}: BookingFormProps & { draft: BookingDraft | null }) {
  const router = useRouter()
  // One question per screen. Guests price a pickup (no photo); customers book and pay.
  const STEPS = [
    { id: 'where', short: 'Where', title: 'Where should we collect?' },
    { id: 'bins', short: 'Bins', title: 'How many bins?' },
    { id: 'kind', short: 'Waste', title: 'What kind of waste?' },
    ...(guest ? [] : [{ id: 'photo', short: 'Photo', title: 'A photo of your waste' }]),
    { id: 'pay', short: guest ? 'Price' : 'Pay', title: guest ? 'Your price' : 'Check and pay' },
  ]
  const [step, setStep] = useState(0)
  const [pricing, setPricing] = useState(false)
  const known = new Set(sizes.map((s) => s.code))
  // With a saved home, bookings use it by default (unless they priced a different place before signing up).
  const [useHome, setUseHome] = useState(!!home && !draft?.pin)
  const [address, setAddress] = useState(draft?.address ?? '')
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(draft?.pin ?? null)
  const [wasteType, setWasteType] = useState(draft?.wasteType === 'recyclable' ? 'recyclable' : 'general')
  const [hazardous, setHazardous] = useState(acceptHazardous && !!draft?.hazardous)
  const [bins, setBins] = useState<Record<string, number>>(() =>
    Object.fromEntries(Object.entries(draft?.bins ?? {}).filter(([code]) => known.has(code)))
  )
  const [file, setFile] = useState<File | null>(null)
  const [gpsLat, setGpsLat] = useState<number | null>(null)
  const [gpsLng, setGpsLng] = useState<number | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [error, setError] = useState('')
  // Which part of the form the error is about (shown under it too, and focused): place | pin | bins | photo.
  const [errorField, setErrorField] = useState<string | null>(null)
  function fail(field: string, text: string) {
    setError(text)
    setErrorField(field)
    const at = STEPS.findIndex((s) => s.id === FIELD_STEP[field])
    if (at >= 0) setStep(at)
    requestAnimationFrame(() => {
      const el = document.getElementById(field)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el?.focus({ preventScroll: true })
    })
  }
  const fieldError = (field: string) => (errorField === field ? error : undefined)
  const [loading, setLoading] = useState(false)

  const [pendingConfirm, setPendingConfirm] = useState<{
    orderId: string
    distanceMeters: number
    requote: { oldPrice: number; newPrice: number; zoneName: string; collectionLabel: string } | null
  } | null>(null)

  const supabase = createClient()
  const totalBins = Object.values(bins).reduce((a, b) => a + b, 0)
  const pickupAddress = useHome && home ? homeLabel(home.address, home.landmark) : address

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
      fail('place', 'Please describe the pickup place, with a landmark')
      return
    }
    if (!useHome && !pin) {
      fail('pin', 'Please place the pin on the pickup spot on the map')
      return
    }
    if (totalBins < 1) {
      fail('bins', 'Please choose at least one bin')
      return
    }

    setError('')
    setErrorField(null)
    setLoading(true)
    try {
      const res = await fetch(guest ? '/api/pricing/quote-public' : '/api/pricing/quote', {
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

  // Live price on the waste step (signed-in customers): worked out once bins and the kind of waste are chosen,
  // a moment after the last change.
  useEffect(() => {
    if (guest || STEPS[step]?.id !== 'kind' || totalBins < 1 || quote) return
    if (!useHome && (!address.trim() || !pin)) return
    const t = setTimeout(async () => {
      setPricing(true)
      try {
        const res = await fetch('/api/pricing/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderBody()) })
        if (res.ok) setQuote(await res.json())
      } catch {
        // the price is worked out again on the last step
      } finally {
        setPricing(false)
      }
    }, 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bins, step, quote, useHome, address, pin, wasteType, hazardous])

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
      fail('place', 'Please describe the pickup place, with a landmark')
      return
    }
    if (!useHome && !pin) {
      fail('pin', 'Please place the pin on the pickup spot on the map')
      return
    }
    if (!file) {
      fail('photo', 'Please add a photo of your waste before continuing')
      return
    }

    setError('')
    setErrorField(null)
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
      console.error('[booking] photo upload failed', uploadError)
      setLoading(false)
      setError("Your photo didn't upload. Please check your connection and try again.")
      return
    }
    clearDraft() // booked: the priced pickup is no longer needed

    const evidenceRes = await fetch('/api/orders/add-evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: orderData.id, photoPath: filePath, type: 'customer_placement', gpsLat, gpsLng }),
    })

    if (!evidenceRes.ok) {
      setLoading(false)
      setError("Your photo didn't save. Please try again.")
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
    setErrorField(null)
    setLoading(true)
    await payNow(pendingConfirm.orderId)
  }

  function goBackAndFixAddress() {
    setPendingConfirm(null)
    setStep(0)
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
            <MapPinOff aria-hidden className="mt-0.5 size-5 shrink-0 text-warn-deep" />
            <span>
              Your photo&apos;s location is about <strong>{Math.round(pendingConfirm.distanceMeters)} m</strong> from the
              pickup address (<strong>{pickupAddress}</strong>). This can happen if your phone&apos;s location is briefly
              inaccurate, or if the address doesn&apos;t quite match where you are.
            </span>
          </p>

          {rq && (
            <p className="mt-4 rounded-control bg-warn-wash p-4 text-[15px] text-ink">
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

  // No account yet: keep what they chose on this phone, then sign up (or sign in) to book it.
  function continueToAccount(path: '/signup' | '/login') {
    saveDraft({ address, pin, wasteType, hazardous, bins })
    router.push(path)
  }

  const optionCard = (on: boolean) =>
    `lift flex cursor-pointer items-start gap-3 rounded-card p-4 ring-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
      on ? 'bg-action-wash ring-2 ring-action-deep' : 'bg-surface ring-line-strong'
    }`
  const current = STEPS[step]
  const last = step === STEPS.length - 1

  // Next: check this step's answer, then move on (the price is worked out on the way to "Check and pay").
  function next() {
    if (current.id === 'where') {
      if (!useHome && !address.trim()) return fail('place', 'Please describe the pickup place, with a landmark')
      if (!useHome && !pin) return fail('pin', 'Please place the pin on the pickup spot on the map')
    }
    if (current.id === 'bins' && totalBins < 1) return fail('bins', 'Please choose at least one bin')
    if (current.id === 'photo' && !file) return fail('photo', 'Please add a photo of your waste before continuing')
    setError('')
    setErrorField(null)
    const to = step + 1
    setStep(to)
    if (STEPS[to]?.id === 'pay' && !quote) void getQuote()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function back() {
    setError('')
    setErrorField(null)
    setStep((s) => Math.max(0, s - 1))
  }

  return (
    <div className="max-w-5xl">
      <div className="anim-rise mb-5 max-w-2xl">
        <h1 className="text-[clamp(1.6rem,3vw,2rem)] font-bold leading-tight tracking-[-0.03em]">{guest ? 'Price a pickup' : 'Book a pickup'}</h1>
        <p className="mt-1.5 text-[15px] text-ink-2">
          {guest ? 'See your price and collection night first. You only need an account when you book.' : 'A few quick questions. You see your price and collection night before you pay.'}
        </p>
      </div>
      {!guest && draft && step === 0 && (
        <p role="status" className="anim-note mb-5 flex items-start gap-2.5 rounded-card bg-ok-wash lg:mr-[344px] p-4 text-[15px] text-ink ring-1 ring-ok/25">
          <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-ok-deep" strokeWidth={2.5} />
          We kept the pickup you priced. Check the details, add a photo of your waste, then pay.
        </p>
      )}

      {/* Progress: one segment per question */}
      <ol aria-label="Booking steps" className="mb-5 grid gap-1.5 lg:mr-[344px]" style={{ gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))` }}>
        {STEPS.map((s, i) => (
          <li key={s.id} aria-current={i === step ? 'step' : undefined} className="min-w-0">
            <span className={`block h-1.5 rounded-full transition-colors duration-300 ${i <= step ? 'bg-action-strong' : 'bg-line'}`} />
            <span className={`mt-1.5 block truncate text-xs font-semibold ${i === step ? 'text-ink' : 'text-ink-3'}`}>{s.short}</span>
            <span className="sr-only">{i < step ? '(done)' : i === step ? '(now)' : '(not yet)'}</span>
          </li>
        ))}
      </ol>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
      <section key={current.id} aria-labelledby="step-title" className="anim-rise rounded-card bg-surface p-5 shadow-card ring-1 ring-line/70 sm:p-6">
        <p className="text-sm font-semibold text-ink-3">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 id="step-title" tabIndex={-1} className="mt-1 text-xl font-bold tracking-tight outline-none">
          {current.title}
        </h2>

        {current.id === 'where' && (
          <div className="mt-4">
            {home ? (
              <div className="grid gap-2.5" role="radiogroup" aria-label="Pickup address">
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
                  <HomeIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-action-deep" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">My home</span>
                    <span className="block truncate text-sm text-ink-2">{home.address}</span>
                    {home.landmark && <span className="block truncate text-sm text-ink-3">Landmark: {home.landmark}</span>}
                  </span>
                  <Link href="/dashboard/customer/home-location" className="text-sm font-semibold text-action-deep hover:underline">
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
              <p className="rounded-control bg-warn-wash p-3.5 text-sm text-ink">
                Drivers go exactly to your pin, so please{' '}
                <Link href="/dashboard/customer/home-location" className="font-semibold text-warn-deep underline underline-offset-2">
                  check your home pin
                </Link>{' '}
                once. Until then, place a pin for this order below.
              </p>
            ) : guest ? null : (
              <p className="text-sm text-ink-2">
                Tip:{' '}
                <Link href="/dashboard/customer/home-location" className="font-semibold text-action-deep hover:underline">
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
                    {...fieldA11y('place', fieldError('place'))}
                    placeholder="e.g. House 12, blue gate, near Chemu SHS, Tema Comm. 4"
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value)
                      changed()
                    }}
                    className={`${FIELD} mt-1.5`}
                  />
                  <FieldError id="place" text={fieldError('place')} />
                </div>
                <p className="text-sm text-ink-2">Put the pin exactly on the gate where the bins will be. Your driver goes to this pin.</p>
                <div
                  id="pin"
                  tabIndex={-1}
                  aria-label="Pickup pin on the map"
                  {...fieldA11y('pin', fieldError('pin'))}
                  className={`overflow-hidden rounded-card outline-none ring-1 ${fieldError('pin') ? 'ring-2 ring-danger' : 'ring-line'}`}
                >
                  <PinPicker
                    pin={pin}
                    height={280}
                    onPinChange={(p) => {
                      setPin(p)
                      changed()
                    }}
                  />
                </div>
                <FieldError id="pin" text={fieldError('pin')} />
              </div>
            )}
          </div>
        )}

        {current.id === 'bins' && (
          <div className="mt-4">
            <p id="bins" tabIndex={-1} className="text-sm text-ink-2 outline-none">
              Choose how many of each size you&apos;re putting out.
            </p>
            <FieldError id="bins" text={fieldError('bins')} />
            {sizes.length === 0 ? (
              <p className="mt-3 text-sm text-danger">Booking is not available right now. Please try again later.</p>
            ) : (
              // A phone: one row per bin (picture, size, stepper). Wider screens: three cards side by side.
              <ul className="mt-3 grid gap-2.5 sm:grid-cols-3">
                {sizes.map((size) => {
                  const count = bins[size.code] ?? 0
                  return (
                    <li
                      key={size.code}
                      className={`flex items-center gap-3 rounded-card px-3 py-2.5 ring-1 transition sm:block sm:p-4 sm:text-center ${count > 0 ? 'bg-action-wash ring-2 ring-action-deep' : 'ring-line-strong'}`}
                    >
                      <BinIllustration litres={size.litres} active={count > 0} className="h-16 w-14 shrink-0 text-ink sm:mx-auto sm:h-24 sm:w-auto" />
                      <div className="min-w-0 flex-1 sm:mt-1.5">
                        <p className="text-[17px] font-semibold sm:text-base">{size.litres} L</p>
                        <p className="text-sm text-ink-3 sm:text-xs">{size.label}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 sm:mt-3 sm:justify-center sm:gap-3">
                        <button
                          type="button"
                          aria-label={`Remove one ${size.label.toLowerCase()}`}
                          onClick={() => setCount(size.code, count - 1)}
                          disabled={count === 0}
                          className="press grid size-11 place-items-center rounded-full bg-surface ring-1 ring-line-strong hover:bg-canvas disabled:opacity-40"
                        >
                          <Minus aria-hidden className="size-4" />
                        </button>
                        <span key={count} className="anim-pop min-w-6 text-lg font-bold tabular-nums" aria-live="polite">
                          {count}
                        </span>
                        <button
                          type="button"
                          aria-label={`Add one ${size.label.toLowerCase()}`}
                          onClick={() => setCount(size.code, count + 1)}
                          disabled={count >= MAX_PER_SIZE}
                          className="press grid size-11 place-items-center rounded-full bg-action text-on-action hover:brightness-105 disabled:opacity-40"
                        >
                          <Plus aria-hidden className="size-4" />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="mt-4 text-sm text-ink-3">Next, tell us what kind of waste it is. Then you see your price.</p>
          </div>
        )}

        {current.id === 'kind' && (
          <div className="mt-4">
            <div className="grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Waste type">
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
                    <Recycle aria-hidden className="mt-0.5 size-5 shrink-0 text-action-deep" />
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
            {acceptHazardous ? (
              <label className="mt-4 flex cursor-pointer items-start gap-3 text-[15px]">
                <input
                  type="checkbox"
                  checked={hazardous}
                  onChange={(e) => {
                    setHazardous(e.target.checked)
                    changed()
                  }}
                  className="mt-1 size-4 accent-[var(--color-action-deep)]"
                />
                <span>
                  Contains hazardous items <span className="text-ink-2">(batteries, chemicals, paint, medical waste). An extra charge applies.</span>
                </span>
              </label>
            ) : (
              <p className="mt-4 text-sm text-ink-2">
                We can&apos;t collect hazardous waste yet (batteries, chemicals, paint, medical waste). Please keep it out of your bins.
              </p>
            )}
            <p aria-live="polite" className="mt-4 flex items-baseline justify-between gap-3 rounded-[16px] bg-canvas px-4 py-3 text-sm">
              <span className="text-ink-2">
                {`${totalBins} bin${totalBins === 1 ? '' : 's'}, ${wasteType === 'recyclable' ? 'recyclable' : 'general waste'}`}
                {quote ? ` · ${quote.zoneName}` : ''}
              </span>
              <span key={quote?.price ?? 'none'} className="anim-pop text-lg font-bold tabular-nums">
                {quote ? `GHS ${quote.price.toFixed(2)}` : guest ? 'Price on the last step' : 'Pricing…'}
              </span>
            </p>
          </div>
        )}

        {current.id === 'photo' && (
          <div className="mt-4">
            <p id="photo" tabIndex={-1} className="text-sm text-ink-2 outline-none">
              Required. It helps your driver know what to expect.
            </p>
            <FieldError id="photo" text={fieldError('photo')} />
            <div className="mt-4 flex flex-wrap items-center gap-3">
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
                <span className="anim-pop inline-flex items-center gap-1.5 text-sm font-semibold text-ok-deep">
                  <Check aria-hidden className="size-4" strokeWidth={3} /> Photo added
                </span>
              )}
            </div>
            <div className="mt-4 max-w-sm">
              <PhotoPreview file={file} label="Your waste photo" />
            </div>
          </div>
        )}

        {current.id === 'pay' && (
          <div className="mt-4">
            <dl className="grid gap-2 rounded-[16px] bg-canvas p-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Where</dt>
                <dd className="min-w-0 truncate text-right font-medium">{useHome ? 'My home' : pickupAddress}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-3">Waste</dt>
                <dd className="font-medium">
                  {wasteType === 'recyclable' ? 'Recyclable' : 'General'}
                  {hazardous ? ', with hazardous items' : ''}
                </dd>
              </div>
              {!guest && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-3">Photo</dt>
                  <dd className="font-medium">{file ? 'Added' : 'Missing'}</dd>
                </div>
              )}
            </dl>

            {!quote ? (
              <>
                <ErrorText text={error} />
                {loading ? (
                  <div className="mt-4 grid gap-2" role="status" aria-label="Working out your price">
                    <span className="skeleton block h-5 w-2/3" />
                    <span className="skeleton block h-5 w-1/2" />
                    <span className="skeleton block h-9 w-full" />
                  </div>
                ) : (
                  <button onClick={getQuote} disabled={sizes.length === 0} className={`mt-5 w-full ${BUTTON_PRIMARY}`}>
                    Work out my price
                  </button>
                )}
              </>
            ) : (
              <>
                <dl className="anim-rise mt-4 grid gap-1.5 text-sm">
                  {quote.lines.map((l) => (
                    <div key={l.code} className="flex justify-between gap-3">
                      <dt className="text-ink-2">
                        {l.count} × {l.litres} L
                      </dt>
                      <dd className="tabular-nums">GHS {l.lineTotal.toFixed(2)}</dd>
                    </div>
                  ))}
                  {quote.recyclableDiscount > 0 && (
                    <div className="flex justify-between gap-3 text-ok-deep">
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
                  {(quote.taxLines ?? []).map((t) => (
                    <div key={t.code} className="flex justify-between gap-3">
                      <dt className="text-ink-2">
                        {t.label} ({t.percent}%)
                      </dt>
                      <dd className="tabular-nums">+ GHS {t.amount.toFixed(2)}</dd>
                    </div>
                  ))}
                  <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line pt-3">
                    <dt className="font-semibold">Total</dt>
                    <dd className="text-3xl font-bold tabular-nums tracking-tight">GHS {quote.price.toFixed(2)}</dd>
                  </div>
                </dl>
                <p className="mt-1 text-xs text-ink-3">Area: {quote.zoneName}</p>

                <p className="mt-4 flex items-start gap-2.5 rounded-[16px] bg-hero p-3.5 text-sm text-on-hero">
                  <Moon aria-hidden className="mt-0.5 size-4 shrink-0 text-highlight" />
                  <span>
                    <strong className="font-semibold">Collection: {quote.collectionLabel}.</strong> Please put your bins out before the collection
                    starts.
                  </span>
                </p>

                <ErrorText text={error} />
                {guest ? (
                  <>
                    <button onClick={() => continueToAccount('/signup')} className={`mt-5 w-full ${BUTTON_PRIMARY}`}>
                      Create an account to book
                    </button>
                    <button onClick={() => continueToAccount('/login')} className={`mt-2.5 w-full ${BUTTON_QUIET}`}>
                      I already have an account
                    </button>
                    <p className="mt-2.5 text-center text-xs text-ink-3">It takes a minute. Your bins and pin are kept.</p>
                  </>
                ) : (
                  <>
                    <button onClick={confirmBooking} disabled={loading} className={`mt-5 w-full ${BUTTON_PRIMARY}`}>
                      {loading ? 'Booking…' : `Book and pay GHS ${quote.price.toFixed(2)}`}
                    </button>
                    <p className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-ink-3">
                      <Lock aria-hidden className="size-3.5" /> Secure payment with MoMo or card via Paystack
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {current.id !== 'pay' && <ErrorText text={errorField ? '' : error} />}

        <div className="mt-6 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button type="button" onClick={back} className={BUTTON_QUIET}>
              <ArrowLeft aria-hidden className="size-4" /> Back
            </button>
          ) : (
            <span />
          )}
          {!last && (
            <button type="button" onClick={next} disabled={current.id === 'bins' && sizes.length === 0} className={BUTTON_PRIMARY}>
              Next <ArrowRight aria-hidden className="size-4" />
            </button>
          )}
        </div>
      </section>

      {/* On a computer: what's been chosen so far, and the price as soon as it's known. */}
      <aside aria-label="Your pickup so far" className="anim-rise hidden lg:sticky lg:top-24 lg:block">
        <div className="hero-glow grid gap-4 rounded-card bg-hero p-5 text-on-hero shadow-lift">
          <p className="text-sm text-on-hero-2">Your pickup</p>
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-on-hero-2">Where</dt>
              <dd className="mt-0.5 truncate font-semibold">{useHome && home ? 'My home' : address.trim() || 'Not chosen yet'}</dd>
            </div>
            <div>
              <dt className="text-on-hero-2">Bins</dt>
              <dd className="mt-0.5 font-semibold">
                {totalBins > 0
                  ? sizes
                      .filter((z) => (bins[z.code] ?? 0) > 0)
                      .map((z) => `${bins[z.code]} × ${z.litres} L`)
                      .join(', ')
                  : 'None yet'}
              </dd>
            </div>
            <div>
              <dt className="text-on-hero-2">Waste</dt>
              <dd className="mt-0.5 font-semibold">
                {wasteType === 'recyclable' ? 'Recyclable' : 'General'}
                {hazardous ? ', with hazardous items' : ''}
              </dd>
            </div>
          </dl>
          <div className="rounded-[16px] bg-white/8 p-4">
            <p className="text-sm text-on-hero-2">Price</p>
            <p aria-live="polite" className="mt-1 text-[28px] font-bold leading-none tracking-tight tabular-nums">
              {quote ? `GHS ${quote.price.toFixed(2)}` : pricing ? '…' : '—'}
            </p>
            <p className="mt-2 text-xs text-on-hero-2">
              {quote ? `${quote.zoneName} · ${quote.collectionLabel}` : 'Worked out for your area. You see it in full before you pay.'}
            </p>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-on-hero-2">
            <Lock aria-hidden className="size-3.5" /> MoMo or card, through Paystack
          </p>
        </div>
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
