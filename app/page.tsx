import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, BadgeCheck, Building2, Camera, Check, ChevronDown, Clock, Home as HomeIcon, MapPin, Phone } from 'lucide-react'
import DeletedNotice from '@/components/landing/DeletedNotice'
import NightStory, { storyAfter } from '@/components/landing/NightStory'
import SiteHeader from '@/components/landing/SiteHeader'
import SiteFooter from '@/components/landing/SiteFooter'
import { activeZones, coverageMapUrl, PROOF_STATS, TESTIMONIAL } from '@/lib/marketing'
import { getAcceptHazardous, getShiftSettings } from '@/lib/settings'
import { shortClock } from '@/lib/shift'

// Public landing page. Coverage and the booking time come from the live settings; refreshed hourly.
export const revalidate = 3600

const FAQ = [
  {
    q: 'What can I put out for collection?',
    a: 'Household waste in standard bins of 30, 60 or 120 litres. Tell us when you book if it is recyclable or hazardous; hazardous waste costs a little more so it can be handled safely.',
    noHazardous:
      "Household waste in standard bins of 30, 60 or 120 litres. Tell us when you book if it is recyclable. We can't collect hazardous waste yet (batteries, chemicals, paint, medical waste).",
  },
  {
    q: 'What if my gate is hard to find?',
    a: 'You drop a pin exactly on your gate, and you can add a short note such as “black gate, opposite the school”. Your driver navigates straight to the pin and can call you if needed.',
  },
  {
    q: 'How do I know my bins were collected?',
    a: 'Your driver takes a photo at pickup, and your order page shows each step through the night. You get an alert when your bins are collected.',
  },
  {
    q: 'Can I cancel after paying?',
    a: 'Yes. You can cancel for a full refund until your collection night starts at 8pm. After that, a driver may already be on the way, so contact support.',
  },
]

const TRUST = [
  { icon: BadgeCheck, text: 'Every driver is approved with their Ghana Card number, a photo and their vehicle.' },
  { icon: Clock, text: 'Every assignment, pickup and unload is recorded with its time.' },
  { icon: Camera, text: 'Pickup photos are stored privately and checked when something looks off.' },
  { icon: Phone, text: 'A real person handles missed pickups, disputes and refunds.' },
]

const TITLE = 'text-[clamp(2rem,4vw,3.25rem)] font-bold leading-[1.04] tracking-[-0.04em]'
const MAIN_BUTTON =
  'press group inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-action px-7 text-base font-semibold text-on-action shadow-lift transition hover:brightness-105'

export default async function Home() {
  const [zones, acceptHazardous, settings] = await Promise.all([
    activeZones(),
    getAcceptHazardous().catch(() => false),
    getShiftSettings().catch(() => null),
  ])
  const mapUrl = coverageMapUrl(zones)
  const snapshot = settings ? shortClock(settings.planningSnapshotMinutes) : '7pm'
  const cutoff = settings ? shortClock(settings.hardCutoffMinutes) : 'midnight'

  return (
    <div data-surface="new" className="bg-canvas text-ink">
      <SiteHeader overHero />

      <main>
        <DeletedNotice />

        {/* Hero: a Trashit tricycle collecting at a gate on a Tema street before dawn, the promise and the one main
            button. On computers and tablets on their side the words sit over the photo (darker on the left, where they are); on phones and upright tablets the photo
            comes first and the words sit below it. It runs under the see-through top bar (components/landing/SiteHeader). */}
        <section
          aria-labelledby="hero-title"
          className="relative isolate -mt-16 flex h-[100svh] min-h-[480px] flex-col overflow-hidden bg-[#0b1424] text-white sm:-mt-[72px] lg:block lg:min-h-0"
        >
          <div className="relative min-h-[140px] flex-1 lg:absolute lg:inset-0">
            <Image
              src="/landing/tema-street-dawn.jpg"
              alt="A Trashit aboboyaa tricycle tipping a customer's bin at a gate on a quiet Tema street before dawn, its driver beside it"
              fill
              priority
              sizes="100vw"
              className="object-cover object-[78%_50%] brightness-[.78] contrast-[1.04] lg:object-[62%_50%]"
            />
            <span aria-hidden className="hero-shade-phone absolute inset-0 lg:hidden" />
            <span aria-hidden className="hero-shade-wide absolute inset-0 hidden lg:block" />
          </div>
          <div className="relative mx-auto flex w-full max-w-6xl px-4 sm:px-6 lg:h-full lg:items-center lg:pb-20 lg:pt-[72px]">
            <div className="-mt-10 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:mt-0 lg:max-w-[42rem] lg:pb-0">
              <h1 id="hero-title" className="text-[clamp(2.5rem,min(7vw,9svh),5rem)] font-bold leading-[0.95] tracking-[-0.045em] [text-shadow:0_2px_24px_rgb(0_0_0/0.35)]">
                <span className="word">
                  <span style={{ animationDelay: '80ms' }}>Your</span>
                </span>{' '}
                <span className="word">
                  <span style={{ animationDelay: '150ms' }}>bin,</span>
                </span>{' '}
                <span className="word">
                  <span style={{ animationDelay: '220ms' }}>cleared</span>
                </span>
                <br />
                <span className="word">
                  <span style={{ animationDelay: '320ms' }} className="text-[#9be07a]">
                    overnight.
                  </span>
                </span>
              </h1>
              <p className="anim-rise mt-4 max-w-[32rem] lg:mt-[2.4svh] text-[clamp(1.05rem,1.6vw,1.2rem)] leading-relaxed text-[#e9eef4] [animation-delay:500ms]">
                Book by {snapshot} and a Trashit driver collects your refuse from your gate before daybreak.
              </p>
              <div className="anim-rise mt-6 flex w-full flex-col lg:mt-[3.4svh] items-stretch gap-3 [animation-delay:620ms] sm:w-auto sm:flex-row sm:items-center">
                <Link href="/book" data-magnet className={MAIN_BUTTON}>
                  Book tonight&apos;s pickup <ArrowRight aria-hidden className="size-5 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="#how"
                  className="press inline-flex min-h-14 items-center justify-center rounded-full bg-white/5 px-7 text-base font-semibold text-white ring-1 ring-white/55 backdrop-blur-sm transition hover:bg-white/15"
                >
                  How it works
                </Link>
              </div>
              <ul className="anim-rise mt-5 flex flex-wrap lg:mt-[3svh] gap-x-6 gap-y-2 text-sm font-medium text-[#dfe6ee] [animation-delay:740ms]">
                {[`Late bookings until ${cutoff}`, 'Pay with MoMo', 'Photo proof of pickup'].map((t) => (
                  <li key={t} className="inline-flex items-center gap-2">
                    <Check aria-hidden className="size-4 text-[#9be07a]" strokeWidth={2.6} /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <a
            href="#how"
            className="tour-cue anim-fade absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2.5 text-sm font-semibold text-[#dfe6ee] [animation-delay:1100ms] lg:flex"
          >
            <span aria-hidden className="scroll-cue relative h-[38px] w-6 rounded-full ring-2 ring-white/50" />
            Scroll to follow one pickup
          </a>
        </section>

        <NightStory snapshot={snapshot} />

        {/* Everything after the tour slides up over it like a curtain. */}
        <div className={storyAfter}>
          {/* After the tour: the invitation, while the story is fresh. */}
          <section className="px-4 pb-8 pt-20 text-center sm:px-6 sm:pt-28">
            <div className="tour-text mx-auto max-w-2xl">
              <h2 className={TITLE}>That&apos;s one night. Your gate is next.</h2>
              <p className="mt-4 text-lg text-ink-2">Pin it once, and book whenever your bins are full.</p>
              <Link href="/book" data-magnet className={`mt-8 ${MAIN_BUTTON}`}>
                Book tonight&apos;s pickup <ArrowRight aria-hidden className="size-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </section>

          {/* Proof strip: shown only once real figures exist (lib/marketing.ts) */}
          {PROOF_STATS.length > 0 && (
            <section aria-label="Trashit in numbers" className="px-4 pt-16 sm:px-6">
              <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-8 rounded-card bg-hero p-8 text-on-hero md:grid-cols-4">
                {PROOF_STATS.map((s) => (
                  <div key={s.label}>
                    <dt className="text-sm text-on-hero-2">{s.label}</dt>
                    <dd className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Coverage */}
          <section id="coverage" className="scroll-mt-20 px-4 py-24 sm:px-6 sm:py-28">
            <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
              <figure data-tilt className="tour-moment overflow-hidden rounded-card bg-surface shadow-lift ring-1 ring-line/70">
                {mapUrl ? (
                  <Image
                    src={mapUrl}
                    alt={`Map of the areas Trashit collects in: ${zones.map((z) => z.name).join(', ')}`}
                    width={640}
                    height={440}
                    sizes="(min-width: 1024px) 600px, 100vw"
                    className="block h-auto w-full"
                  />
                ) : (
                  <div className="grid aspect-[16/11] place-items-center bg-rail text-ink-3">
                    <MapPin aria-hidden className="size-8" />
                  </div>
                )}
                {mapUrl && <figcaption className="px-4 py-2 text-[11px] text-ink-3">© Mapbox © OpenStreetMap</figcaption>}
              </figure>
              <div className="tour-text">
                <h2 className={TITLE}>{zones.length > 0 ? 'Where we collect tonight.' : 'Coverage is opening soon.'}</h2>
                <p className="mt-4 text-lg leading-relaxed text-ink-2">
                  {zones.length > 0
                    ? 'Night routes run in these areas now, and new areas open as drivers join. When you book, we check your pin against them.'
                    : 'We are setting up our first night routes. Sign up and we will tell you when your area opens.'}
                </p>
                {zones.length > 0 && (
                  <ul className="mt-6 flex flex-wrap gap-2">
                    {zones.map((z) => (
                      <li
                        key={z.name}
                        className="inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-2 text-sm font-semibold shadow-card ring-1 ring-line/70 transition hover:-translate-y-0.5"
                      >
                        <span aria-hidden className="size-2 animate-pulse rounded-full bg-action-deep" /> {z.name}
                        <span className="font-normal text-ink-3">· {z.city}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/book" className="group mt-8 inline-flex items-center gap-1.5 font-semibold text-action-deep underline-offset-4 hover:underline">
                  Check your gate pin <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </section>

          {/* Audiences */}
          <section id="drivers" className="scroll-mt-20 px-4 pb-24 sm:px-6 sm:pb-28">
            <div className="mx-auto max-w-6xl">
              <h2 className={`tour-text max-w-2xl ${TITLE}`}>For households, drivers and businesses.</h2>
              <div className="mt-12 grid gap-5 lg:grid-cols-[1.25fr_1fr]">
                <article data-tilt className="sheen tour-moment relative overflow-hidden rounded-card bg-[#123a2e] p-8 text-white shadow-lift sm:p-10">
                  <span aria-hidden className="road-dash absolute -right-10 bottom-8 h-1 w-64 rounded-full opacity-70" style={{ ['--color-highlight' as string]: '#d9a06b' }} />
                  <span className="inline-flex rounded-full bg-[#d9a06b] px-3 py-1 text-xs font-bold text-[#1b140c]">Drivers</span>
                  <h3 className="mt-5 text-[clamp(1.6rem,3vw,2.1rem)] font-bold leading-tight tracking-[-0.035em]">Drive nights. Get paid to MoMo.</h3>
                  <p className="mt-3 max-w-[46ch] leading-relaxed text-[#bfd3c8]">
                    Use your Borla car or aboboyaa. Accept the stops you can reach, navigate straight to each gate, and withdraw your
                    earnings to your mobile money wallet.
                  </p>
                  <ul className="mt-6 grid gap-2.5 text-[15px]">
                    {[
                      '40% of your share at pickup, 60% once the unload is verified',
                      'Go online only when you want to work',
                      'Approval with your Ghana Card number and a vehicle photo',
                    ].map((t) => (
                      <li key={t} className="flex items-start gap-2.5">
                        <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-[#d9a06b]" strokeWidth={2.6} /> {t}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup?role=driver"
                    data-magnet
                    className="press group mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-[#123a2e]"
                  >
                    Start driver sign-up <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </article>

                <div className="grid gap-5">
                  <article data-tilt className="tour-moment rounded-card bg-surface p-8 shadow-card ring-1 ring-line/70">
                    <span className="grid size-12 place-items-center rounded-[16px] bg-action-wash text-action-deep">
                      <HomeIcon aria-hidden className="size-6" />
                    </span>
                    <h3 className="mt-5 text-xl font-bold tracking-tight">Households</h3>
                    <p className="mt-2 leading-relaxed text-ink-2">
                      Save your home pin once and book whenever your bins are full. Add Trashit to your home screen and turn on alerts
                      to follow your pickup through the night.
                    </p>
                  </article>
                  <article data-tilt className="tour-moment rounded-card bg-surface p-8 shadow-card ring-1 ring-line/70">
                    <span className="grid size-12 place-items-center rounded-[16px] bg-action-wash text-action-deep">
                      <Building2 aria-hidden className="size-6" />
                    </span>
                    <h3 className="mt-5 text-xl font-bold tracking-tight">Properties and businesses</h3>
                    <p className="mt-2 leading-relaxed text-ink-2">
                      Accounts with several sites on one bill are on the way. Until then, each property can book on its own account.
                    </p>
                  </article>
                </div>
              </div>
            </div>
          </section>

          {/* Trust */}
          <section className="px-4 pb-24 sm:px-6 sm:pb-28">
            <div className={`mx-auto grid max-w-6xl gap-12 ${TESTIMONIAL ? 'lg:grid-cols-[1.2fr_1fr]' : ''}`}>
              {TESTIMONIAL && (
                <figure>
                  <blockquote className="text-[clamp(1.4rem,2.6vw,2rem)] font-semibold leading-snug tracking-tight">“{TESTIMONIAL.quote}”</blockquote>
                  <figcaption className="mt-5 text-sm text-ink-3">
                    {TESTIMONIAL.name} · {TESTIMONIAL.area}
                  </figcaption>
                </figure>
              )}
              <div className={TESTIMONIAL ? '' : 'grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-start'}>
                <h2 className={`tour-text ${TITLE}`}>Trust you can check, not just take our word for.</h2>
                <ul className={`grid gap-3.5 ${TESTIMONIAL ? 'mt-8' : 'sm:grid-cols-2'}`}>
                  {TRUST.map(({ icon: Icon, text }) => (
                    <li key={text} className="tour-moment lift flex items-start gap-3.5 rounded-card bg-surface p-5 shadow-card ring-1 ring-line/70">
                      <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-action-wash text-action-deep">
                        <Icon aria-hidden className="size-5" />
                      </span>
                      <span className="text-[15px] leading-relaxed text-ink-2">{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="scroll-mt-20 px-4 pb-24 sm:px-6 sm:pb-28">
            <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.5fr]">
              <div className="tour-text">
                <h2 className={TITLE}>Before your first pickup.</h2>
                <p className="mt-4 text-lg text-ink-2">Short answers to what people ask most.</p>
              </div>
              <div className="divide-y divide-line border-y border-line">
                {FAQ.map((f, i) => (
                  <details key={f.q} open={i === 0} className="faq group py-1">
                    <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[17px] font-semibold transition-[padding] duration-200 hover:pl-1.5 [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <ChevronDown aria-hidden className="size-5 shrink-0 text-ink-3 transition-transform duration-300 group-open:rotate-180" />
                    </summary>
                    <p className="max-w-[65ch] pb-5 leading-relaxed text-ink-2">{!acceptHazardous && 'noHazardous' in f ? f.noHazardous : f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* Close: the night, once more */}
          <section className="px-4 pb-20 sm:px-6 sm:pb-24">
            <div data-spot className="spotlight sheen relative isolate mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-hero px-6 py-20 text-center text-on-hero sm:px-12 sm:py-24">
              <span aria-hidden className="stars-layer absolute inset-0 -z-10 opacity-60" />
              <span aria-hidden className="absolute right-10 top-10 size-12 rotate-[-20deg] rounded-full shadow-[-12px_7px_0_0_#eadba8] sm:right-14 sm:top-12" />
              <h2 className="mx-auto max-w-2xl text-[clamp(2rem,4.4vw,3.4rem)] font-bold leading-[1.04] tracking-[-0.04em]">
                Put your bins out tonight. Wake up to a clear gate.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-on-hero-2">Pin your gate, choose your bins and pay with MoMo.</p>
              <Link href="/book" data-magnet className={`mt-9 ${MAIN_BUTTON}`}>
                Book tonight&apos;s pickup <ArrowRight aria-hidden className="size-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
