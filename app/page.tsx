import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Camera,
  Check,
  ChevronDown,
  Clock,
  Crosshair,
  MapPin,
  Phone,
  Route,
  ShieldCheck,
  Home as HomeIcon,
  Truck,
  Wallet,
} from 'lucide-react'
import Logo from '@/components/Logo'
import HeroFlow from '@/components/landing/HeroFlow'
import DeletedNotice from '@/components/landing/DeletedNotice'
import { activeZones, coverageMapUrl, PROOF_STATS, TESTIMONIAL } from '@/lib/marketing'

// Public landing page. Coverage comes from the live zones; refreshed hourly.
export const revalidate = 3600

const NIGHT = [
  {
    time: 'Before 6pm',
    title: 'Pin your gate and pay',
    text: 'Drop an exact pin on your gate, choose 30, 60 or 120 litre bins, and pay with MoMo.',
    icon: MapPin,
    tone: 'customer',
  },
  {
    time: '6pm',
    title: 'Tonight’s route is planned',
    text: 'Your stop goes to a nearby approved driver, who accepts it before the shift starts.',
    icon: Route,
    tone: 'ops',
  },
  {
    time: '8pm – 6am',
    title: 'Collected at your gate',
    text: 'The driver comes straight to your pin and takes a photo when your bins are picked up.',
    icon: Camera,
    tone: 'driver',
  },
  {
    time: 'By morning',
    title: 'Unload verified',
    text: 'The load is checked in at a licensed disposal site, and your order shows it’s done.',
    icon: ShieldCheck,
    tone: 'ops',
  },
] as const

const TONE = {
  customer: { dot: 'bg-customer', icon: 'text-customer-deep bg-customer-wash', bar: 'from-customer' },
  driver: { dot: 'bg-driver', icon: 'text-driver-deep bg-driver-wash', bar: 'from-driver' },
  ops: { dot: 'bg-ops', icon: 'text-ops-deep bg-ops-wash', bar: 'from-ops' },
}

const FAQ = [
  {
    q: 'What can I put out for collection?',
    a: 'Household waste in standard bins of 30, 60 or 120 litres. Tell us when you book if it is recyclable or hazardous; hazardous waste costs a little more so it can be handled safely.',
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

export default async function Home() {
  const zones = await activeZones()
  const mapUrl = coverageMapUrl(zones)

  return (
    <div data-surface="new" className="bg-surface text-ink">
      {/* Navigation */}
      <header className="sticky top-0 z-30 border-b border-line/80 bg-surface/90 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6" aria-label="Main">
          <Link href="/" aria-label="Trashit home" className="shrink-0">
            <Logo height={30} />
          </Link>
          <div className="hidden items-center gap-7 text-sm font-medium text-ink-2 md:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#coverage" className="hover:text-ink">Where we collect</a>
            <a href="#drivers" className="hover:text-ink">Drive with us</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-control px-3 py-2.5 text-sm font-medium text-ink-2 hover:text-ink">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-control bg-customer px-4 text-sm font-semibold text-white shadow-card transition hover:bg-customer-deep"
            >
              Book a pickup <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <DeletedNotice />
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:pb-24 lg:pt-16">
          <div>
            <h1 className="text-[clamp(2.4rem,5.4vw,4.1rem)] font-bold leading-[1.02] tracking-[-0.035em]">
              Your bin, cleared overnight.
            </h1>
            <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-ink-2">
              Book by 6pm and a Trashit driver collects from your gate during the night, takes it to a licensed disposal
              site, and shows you proof at every step.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="inline-flex min-h-12 items-center gap-2 rounded-control bg-customer px-6 text-base font-semibold text-white shadow-card transition hover:bg-customer-deep"
              >
                Book tonight&apos;s pickup <ArrowRight aria-hidden className="size-4" />
              </Link>
              <Link
                href="/signup?role=driver"
                className="inline-flex min-h-12 items-center gap-2 rounded-control px-5 text-base font-semibold text-ink ring-1 ring-line-strong transition hover:bg-canvas"
              >
                <Truck aria-hidden className="size-4 text-driver-deep" /> Become a driver
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink-2">
              {['Book by 6pm, late orders until midnight', 'Pay with MoMo', 'Photo proof of pickup'].map((t) => (
                <li key={t} className="inline-flex items-center gap-2">
                  <Check aria-hidden className="size-4 text-customer" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <HeroFlow />
        </section>

        {/* One night, four steps */}
        <section id="how" className="scroll-mt-20 border-t border-line bg-canvas py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] font-bold leading-tight tracking-[-0.03em]">
                From gate pin to cleared bin, in one night.
              </h2>
              <p className="mt-4 text-lg text-ink-2">Every step happens on a schedule you can see, and every step leaves proof.</p>
            </div>

            <div className="relative mt-14">
              {/* The night, as a bar from evening to morning */}
              <div aria-hidden className="absolute left-0 right-0 top-[22px] hidden h-[3px] rounded-full bg-gradient-to-r from-customer via-driver to-ops md:block" />
              <div aria-hidden className="absolute bottom-6 left-[20.5px] top-6 w-[3px] rounded-full bg-gradient-to-b from-customer via-driver to-ops md:hidden" />
              <ol className="grid gap-10 md:grid-cols-4 md:gap-6">
                {NIGHT.map((s, i) => {
                  const Icon = s.icon
                  const t = TONE[s.tone]
                  return (
                    <li key={s.title} className="night-step relative grid grid-cols-[auto_1fr] gap-x-4 md:block" style={{ ['--i' as string]: i }}>
                      <span className={`relative z-10 grid size-11 place-items-center rounded-full ring-4 ring-canvas ${t.icon}`}>
                        <Icon aria-hidden className="size-5" />
                      </span>
                      <div className="md:mt-6">
                        <p className="text-sm font-semibold tabular-nums text-ink-3">{s.time}</p>
                        <h3 className="mt-1 text-lg font-semibold tracking-tight">{s.title}</h3>
                        <p className="mt-2 max-w-[30ch] text-[15px] leading-relaxed text-ink-2">{s.text}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>
        </section>

        {/* Proof strip: shown only once real figures exist (lib/marketing.ts) */}
        {PROOF_STATS.length > 0 && (
          <section aria-label="Trashit in numbers" className="bg-night py-12 text-night-ink">
            <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 sm:px-6 md:grid-cols-4">
              {PROOF_STATS.map((s) => (
                <div key={s.label}>
                  <dt className="text-sm text-night-muted">{s.label}</dt>
                  <dd className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Why it works */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="max-w-2xl text-[clamp(1.8rem,3.4vw,2.6rem)] font-bold leading-tight tracking-[-0.03em]">
              Collection day, without the guesswork.
            </h2>
            <div className="mt-12 grid gap-px overflow-hidden rounded-card bg-line ring-1 ring-line md:grid-cols-3">
              <article className="bg-surface p-7">
                <Wallet aria-hidden className="size-6 text-customer" />
                <h3 className="mt-5 text-xl font-semibold tracking-tight">Pay the way you already do</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
                  MTN MoMo, Telecel Cash or AirtelTigo Money, or a card, through Paystack. You see the full price before you pay.
                </p>
                <ul className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
                  {['MTN MoMo', 'Telecel Cash', 'AirtelTigo Money'].map((p) => (
                    <li key={p} className="rounded-full bg-canvas px-2.5 py-1 text-ink-2 ring-1 ring-line">{p}</li>
                  ))}
                </ul>
              </article>
              <article className="bg-surface p-7">
                <Crosshair aria-hidden className="size-6 text-driver-deep" />
                <h3 className="mt-5 text-xl font-semibold tracking-tight">A pin on your gate, not your street</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
                  You place the pin on a satellite map, so your driver arrives at the right gate in the dark, not the middle of
                  the neighbourhood.
                </p>
              </article>
              <article className="bg-surface p-7">
                <BadgeCheck aria-hidden className="size-6 text-ops" />
                <h3 className="mt-5 text-xl font-semibold tracking-tight">Proof you can check</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
                  A photo at pickup, the driver&apos;s GPS, and a check-in at the disposal site. Drivers are paid in full only
                  once the unload is verified.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* Coverage */}
        <section id="coverage" className="scroll-mt-20 bg-night py-20 text-night-ink sm:py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr]">
            <figure className="overflow-hidden rounded-[22px] ring-1 ring-night-line">
              {mapUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mapUrl} alt={`Map of the areas Trashit collects in: ${zones.map((z) => z.name).join(', ')}`} width={640} height={440} className="block h-auto w-full" loading="lazy" />
              ) : (
                <div className="grid aspect-[16/11] place-items-center bg-night-2 text-night-muted">
                  <MapPin aria-hidden className="size-8" />
                </div>
              )}
              {mapUrl && <figcaption className="bg-night-2 px-4 py-2 text-[11px] text-night-muted">© Mapbox © OpenStreetMap</figcaption>}
            </figure>
            <div>
              <h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] font-bold leading-tight tracking-[-0.03em]">
                {zones.length > 0 ? 'Where we collect tonight.' : 'Coverage is opening soon.'}
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-night-muted">
                {zones.length > 0
                  ? 'Night routes run in these areas now, and new areas open as drivers join. When you book, we check your pin against them.'
                  : 'We are setting up our first night routes. Sign up and we will tell you when your area opens.'}
              </p>
              {zones.length > 0 && (
                <ul className="mt-6 flex flex-wrap gap-2">
                  {zones.map((z) => (
                    <li key={z.name} className="inline-flex items-center gap-1.5 rounded-full bg-night-2 px-3 py-1.5 text-sm font-medium ring-1 ring-night-line">
                      <span aria-hidden className="size-2 rounded-full bg-customer-glow" /> {z.name}
                      <span className="text-night-muted">· {z.city}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/signup"
                className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-control bg-customer px-6 font-semibold text-white transition hover:bg-customer-deep"
              >
                Check your gate pin <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Audiences */}
        <section id="drivers" className="scroll-mt-20 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="max-w-2xl text-[clamp(1.8rem,3.4vw,2.6rem)] font-bold leading-tight tracking-[-0.03em]">
              Built for households, drivers and businesses.
            </h2>
            <div className="mt-12 grid gap-5 lg:grid-cols-[1.25fr_1fr]">
              <article className="relative overflow-hidden rounded-[22px] bg-night p-8 text-night-ink sm:p-10">
                <Truck aria-hidden className="relative size-8 text-driver" />
                <h3 className="relative mt-6 text-2xl font-bold tracking-tight sm:text-3xl">Drive nights. Get paid to MoMo.</h3>
                <p className="relative mt-3 max-w-[46ch] leading-relaxed text-night-muted">
                  Use your Borla car or aboboyaa. Accept the stops you can reach, navigate straight to each gate, and withdraw your
                  earnings to your mobile money wallet.
                </p>
                <ul className="relative mt-6 grid gap-2.5 text-[15px]">
                  {[
                    '40% of your share at pickup, 60% once the unload is verified',
                    'Go online only when you want to work',
                    'Approval with your Ghana Card and vehicle photos',
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-driver" /> {t}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup?role=driver"
                  className="relative mt-8 inline-flex min-h-12 items-center gap-2 rounded-control bg-driver px-6 font-semibold text-night transition hover:brightness-105"
                >
                  Start driver sign-up <ArrowRight aria-hidden className="size-4" />
                </Link>
              </article>

              <div className="grid gap-5">
                <article className="rounded-[22px] bg-ops-wash p-8 ring-1 ring-ops/15">
                  <Building2 aria-hidden className="size-7 text-ops" />
                  <h3 className="mt-5 text-xl font-bold tracking-tight">Properties and businesses</h3>
                  <p className="mt-2 leading-relaxed text-ink-2">
                    Accounts for property managers and businesses, with several sites on one bill, are on the way. Until then, each
                    property can book on its own account.
                  </p>
                </article>
                <article className="rounded-[22px] bg-customer-wash p-8 ring-1 ring-customer/15">
                  <HomeIcon aria-hidden className="size-7 text-customer" />
                  <h3 className="mt-5 text-xl font-bold tracking-tight">Households</h3>
                  <p className="mt-2 leading-relaxed text-ink-2">
                    Save your home pin once and book whenever your bins are full. Add Trashit to your home screen and turn on alerts
                    to follow your pickup through the night.
                  </p>
                </article>
              </div>
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="border-t border-line bg-canvas py-20 sm:py-24">
          <div className={`mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 ${TESTIMONIAL ? 'lg:grid-cols-[1.2fr_1fr]' : ''}`}>
            {TESTIMONIAL && (
              <figure>
                <blockquote className="text-[clamp(1.4rem,2.6vw,2rem)] font-semibold leading-snug tracking-tight">
                  “{TESTIMONIAL.quote}”
                </blockquote>
                <figcaption className="mt-5 text-sm text-ink-3">
                  {TESTIMONIAL.name} · {TESTIMONIAL.area}
                </figcaption>
              </figure>
            )}
            <div className={TESTIMONIAL ? '' : 'grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-start'}>
              <h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] font-bold leading-tight tracking-[-0.03em]">
                Trust you can check, not just take our word for.
              </h2>
              <ul className={`grid gap-4 ${TESTIMONIAL ? 'mt-8' : 'sm:grid-cols-2'}`}>
                {[
                  { icon: BadgeCheck, text: 'Every driver is approved with their Ghana Card, a photo and their vehicle.' },
                  { icon: Clock, text: 'Every assignment, pickup and unload is recorded with its time.' },
                  { icon: Camera, text: 'Pickup photos are stored privately and checked when something looks off.' },
                  { icon: Phone, text: 'A real person handles missed pickups, disputes and refunds.' },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 rounded-card bg-surface p-5 ring-1 ring-line">
                    <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-ops" />
                    <span className="text-[15px] leading-relaxed text-ink-2">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.5fr]">
            <div>
              <h2 className="text-[clamp(1.8rem,3.4vw,2.6rem)] font-bold leading-tight tracking-[-0.03em]">Before your first pickup.</h2>
              <p className="mt-4 text-lg text-ink-2">Short answers to what people ask most.</p>
            </div>
            <div className="divide-y divide-line border-y border-line">
              {FAQ.map((f, i) => (
                <details key={f.q} open={i === 0} className="group py-1">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <ChevronDown aria-hidden className="size-5 shrink-0 text-ink-3 transition-transform duration-300 group-open:rotate-180" />
                  </summary>
                  <p className="max-w-[65ch] pb-5 leading-relaxed text-ink-2">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Close */}
        <section className="px-4 pb-20 sm:px-6 sm:pb-24">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-customer px-6 py-16 text-center text-white sm:px-12 sm:py-20">
            <h2 className="mx-auto max-w-2xl text-[clamp(1.9rem,4vw,3rem)] font-bold leading-tight tracking-[-0.03em]">
              Put your bins out tonight. Wake up to a clear gate.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white">Pin your gate, choose your bins and pay with MoMo.</p>
            <Link
              href="/signup"
              className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-control bg-white px-6 font-semibold text-customer-deep shadow-card transition hover:bg-customer-wash"
            >
              Book tonight&apos;s pickup <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-night text-night-muted">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo height={30} onDark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed">Night-time refuse collection in Ghana, with proof at every step.</p>
          </div>
          {[
            { title: 'Service', links: [['Book a pickup', '/signup'], ['How it works', '#how'], ['Where we collect', '#coverage']] },
            { title: 'Work with us', links: [['Drive with Trashit', '/signup?role=driver'], ['Sign in', '/login']] },
            { title: 'Legal', links: [['Privacy', '/privacy-policy'], ['Terms', '/terms'], ['Cookies', '/cookie-policy'], ['Refunds', '/refund-policy']] },
          ].map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-night-ink">{col.title}</h3>
              <ul className="mt-4 grid gap-2.5 text-sm">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="hover:text-night-ink">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-night-line">
          <p className="mx-auto max-w-6xl px-4 py-5 text-xs sm:px-6">© 2026 Trashit · Accra, Ghana</p>
        </div>
      </footer>
    </div>
  )
}
