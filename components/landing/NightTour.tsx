import { BellRing, Camera, Check, CreditCard, Flag, MapPin, Route, ShieldCheck, Smartphone, Truck } from 'lucide-react'

// "One pickup, one night": the landing page's tour. It never pins the page. The chapters scroll by like any section;
// the sky behind them is one long gradient (evening, night, dawn), a route line draws itself down the page, a small
// truck drives it at screen height, and each chapter's moment plays as it arrives (globals.css, "night tour").
// Without scroll-driven animation, or with reduced motion, everything is simply shown finished.

const CARD = 'rounded-card bg-surface text-ink shadow-lift ring-1 ring-line/70'

function MomentPin() {
  return (
    <div className={`${CARD} overflow-hidden p-3`}>
      <div className="relative h-56 overflow-hidden rounded-[18px] bg-rail [perspective:700px]">
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[520px] -translate-x-1/2 -translate-y-[42%] [transform-style:preserve-3d] [transform:rotateX(55deg)_rotateZ(-22deg)]">
          <span className="absolute inset-x-0 top-[44%] h-5 bg-surface" />
          <span className="absolute inset-y-0 left-[40%] w-5 bg-surface" />
          <span className="absolute inset-y-0 left-[74%] w-3 bg-surface" />
          {[
            [6, 8, 26, 22],
            [50, 6, 20, 26],
            [80, 10, 14, 22],
            [6, 56, 22, 26],
            [50, 58, 18, 18],
            [80, 60, 16, 24],
          ].map(([l, t, w, h], i) => (
            <span
              key={i}
              className="absolute rounded-md bg-surface"
              style={{ left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%`, boxShadow: '-8px 16px 0 #cfc4ae' }}
            />
          ))}
          <span className="absolute left-[50%] top-[64%] h-[18%] w-[18%] rounded-2xl bg-[#d3e2c8]" />
        </div>
        <span className="absolute left-1/2 top-[52%] -translate-x-1/2">
          <span aria-hidden className="pin-ring absolute -left-7 top-1 h-4 w-14 rounded-full border-2 border-hero/40" />
          <span className="tour-pin absolute -left-[18px] -top-[46px] grid size-9 rotate-[-45deg] place-items-center rounded-[50%_50%_50%_6px] bg-hero shadow-lift">
            <span className="size-3.5 rounded-full bg-highlight" />
          </span>
        </span>
        <span className="tour-pop-late absolute left-1/2 top-[18%] translate-x-4 rounded-full bg-surface px-3 py-1.5 text-xs font-bold shadow-card">
          Your gate · blue gate, No. 12
        </span>
      </div>
    </div>
  )
}

function MomentBins() {
  const rows = [
    { name: 'Small', size: '30 L', count: '0' },
    { name: 'Medium', size: '60 L', count: null },
    { name: 'Large', size: '120 L', count: '0' },
  ]
  return (
    <div className={`${CARD} grid gap-2.5 p-5`}>
      <p className="text-lg font-bold tracking-tight">How many bins?</p>
      {rows.map((r) => (
        <div
          key={r.name}
          className={`flex items-center justify-between rounded-[16px] px-4 py-3 ${r.count === null ? 'bg-action-wash ring-2 ring-action-deep' : 'bg-canvas'}`}
        >
          <span>
            <span className="block text-[15px] font-semibold">{r.name}</span>
            <span className="block text-xs text-ink-3">{r.size}</span>
          </span>
          <span className="grid size-9 place-items-center rounded-full bg-surface text-[15px] font-bold tabular-nums ring-1 ring-line">
            {r.count ?? <span className="tour-count bins-count" />}
          </span>
        </div>
      ))}
      <p className="mt-1 text-sm text-ink-2">The price for your area shows before you pay.</p>
    </div>
  )
}

function MomentPay() {
  return (
    <div className={`${CARD} grid gap-2.5 p-5`}>
      <p className="text-lg font-bold tracking-tight">Check and pay</p>
      {[
        { name: 'MTN MoMo', icon: Smartphone, on: true },
        { name: 'Telecel Cash', icon: Smartphone, on: false },
        { name: 'Card', icon: CreditCard, on: false },
      ].map(({ name, icon: Icon, on }) => (
        <div key={name} className={`relative flex items-center gap-3 rounded-[16px] px-4 py-3 ${on ? 'bg-surface' : 'bg-canvas'}`}>
          {on && <span aria-hidden className="tour-pop absolute inset-0 rounded-[16px] ring-2 ring-action-deep" />}
          <Icon aria-hidden className="size-4 text-ink-3" />
          <span className="flex-1 text-[15px] font-semibold">{name}</span>
          {on && <span className="tour-pop rounded-full bg-ok-wash px-2.5 py-0.5 text-xs font-bold text-ok-deep">Selected</span>}
        </div>
      ))}
      <div className="relative mt-1 grid h-12 place-items-center overflow-hidden rounded-full bg-action font-bold text-on-action">
        <span>Pay with MoMo</span>
        <span className="tour-wipe absolute inset-0 grid place-items-center bg-hero text-on-hero">
          <span className="flex items-center gap-2">
            <Check aria-hidden className="size-4" strokeWidth={3} /> Paid
          </span>
        </span>
      </div>
    </div>
  )
}

function MomentPlanned({ snapshot }: { snapshot: string }) {
  return (
    <div className="grid gap-3 rounded-card bg-white/[0.07] p-5 text-white ring-1 ring-white/12 backdrop-blur-sm">
      <p className="flex items-center gap-2 text-sm text-[#bfd8c3]">
        <Route aria-hidden className="size-4 text-highlight" /> Planned at {snapshot}
      </p>
      <div className="relative h-24 overflow-hidden rounded-[16px] bg-white/[0.06]">
        <span className="absolute left-5 top-1/2 size-3 -translate-y-1/2 rounded-full bg-[#9cc9e4]" />
        <span className="tour-grow absolute left-7 right-12 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-highlight" />
        <span className="absolute right-6 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-highlight text-on-highlight">
          <MapPin aria-hidden className="size-4" />
        </span>
      </div>
      <div className="flex items-center gap-3 rounded-[16px] bg-white/[0.06] p-3">
        <span className="grid size-9 place-items-center rounded-full bg-[#d9a06b] text-[#1b140c]">
          <Truck aria-hidden className="size-4" />
        </span>
        <span className="flex-1 text-[15px] font-semibold">A nearby approved driver</span>
        <span className="tour-pop rounded-full bg-[#e3f4e2] px-2.5 py-0.5 text-xs font-bold text-[#1d6a33]">Accepted</span>
      </div>
    </div>
  )
}

function MomentCollected() {
  return (
    <div className="relative grid gap-3 rounded-card bg-white/[0.07] p-5 text-white ring-1 ring-white/12 backdrop-blur-sm">
      <div className="tour-pop-late absolute -top-5 left-6 right-6 flex items-center gap-3 rounded-[18px] bg-surface p-3 text-ink shadow-lift">
        <span className="grid size-9 place-items-center rounded-[12px] bg-hero text-highlight">
          <BellRing aria-hidden className="size-4" />
        </span>
        <span className="text-sm">
          <span className="block font-semibold">Your bins were collected</span>
          <span className="text-ink-3">Photo and GPS saved</span>
        </span>
      </div>
      <div className="relative mt-10 h-40 overflow-hidden rounded-[16px] bg-[linear-gradient(140deg,#4a6b4f,#1c3524)]">
        <span className="absolute left-1/2 top-1/2 h-20 w-14 -translate-x-1/2 -translate-y-1/2 rounded-[8px] bg-highlight shadow-[0_-8px_0_-2px_#163320]" />
        <span className="tour-flash absolute inset-0 bg-white" />
        <Camera aria-hidden className="absolute bottom-3 right-3 size-5 text-white/80" />
      </div>
      <p className="flex items-center gap-2 text-sm text-[#bfd8c3]">
        <Check aria-hidden className="size-4 text-highlight" strokeWidth={3} /> Photo taken at your gate
      </p>
    </div>
  )
}

function MomentUnloaded() {
  const steps = ['Paid', 'Driver accepted', 'Collected at your gate', 'Unloaded at a licensed site']
  return (
    <div className={`${CARD} grid gap-3 p-5`}>
      <p className="flex items-center gap-2 text-lg font-bold tracking-tight">
        <ShieldCheck aria-hidden className="size-5 text-ok-deep" /> Done, with proof
      </p>
      <ol className="grid gap-2.5">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-3 text-[15px] font-medium">
            <span className={`grid size-7 place-items-center rounded-full bg-ok-strong text-white ${i < 2 ? 'tour-pop' : 'tour-pop-late'}`}>
              <Check aria-hidden className="size-4" strokeWidth={3} />
            </span>
            {s}
          </li>
        ))}
      </ol>
      <p className="flex items-center gap-2 rounded-[14px] bg-canvas px-3.5 py-2.5 text-sm text-ink-2">
        <Flag aria-hidden className="size-4 text-info" /> Checked in at the disposal site by geofence
      </p>
    </div>
  )
}

type Chapter = { time: string; title: string; text: string; moment: React.ReactNode; dark: boolean }

function ChapterRow({ c, i }: { c: Chapter; i: number }) {
  const right = i % 2 === 1
  return (
    <li className="relative mx-auto grid max-w-6xl items-center gap-6 px-4 pl-[72px] sm:px-6 sm:pl-[80px] md:grid-cols-2 md:gap-24 md:px-6">
      {/* The stop on the route */}
      <span
        aria-hidden
        className={`absolute left-[22px] top-1 z-[5] grid size-8 place-items-center rounded-full text-xs font-bold tabular-nums ring-4 sm:left-[30px] md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 ${
          c.dark ? 'bg-highlight text-on-highlight ring-[#0e1d14]' : 'bg-hero text-on-hero ring-[var(--color-canvas)]'
        }`}
      >
        {i + 1}
      </span>
      <div className={`tour-text ${right ? 'md:order-2' : 'md:text-right'} ${c.dark ? 'text-white' : ''}`}>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${c.dark ? 'bg-highlight text-on-highlight' : 'bg-hero text-on-hero'}`}>{c.time}</span>
        <h3 className="mt-3 text-[clamp(1.6rem,3vw,2.4rem)] font-bold leading-[1.05] tracking-[-0.035em]">{c.title}</h3>
        <p className={`mt-3 text-[17px] leading-relaxed md:max-w-[34ch] ${right ? '' : 'md:ml-auto'} ${c.dark ? 'text-[#bfd8c3]' : 'text-ink-2'}`}>{c.text}</p>
      </div>
      <div className={`tour-moment ${right ? 'md:order-1' : ''}`}>
        <div data-tilt className="mx-auto max-w-[380px]">
          {c.moment}
        </div>
      </div>
    </li>
  )
}

export default function NightTour({ snapshot }: { snapshot: string }) {
  const chapters: Chapter[] = [
    { time: `Before ${snapshot}`, title: 'Drop a pin on your gate.', text: 'Not your street. Your gate. You place it on a satellite map, so your driver finds you in the dark.', moment: <MomentPin />, dark: false },
    { time: `Before ${snapshot}`, title: 'Choose your bins.', text: '30, 60 or 120 litres. The price is worked out for your area and shown in full before you pay.', moment: <MomentBins />, dark: false },
    { time: `Before ${snapshot}`, title: 'Pay the way you already do.', text: 'MTN MoMo, Telecel Cash, AirtelTigo Money or a card, through Paystack. Cancel for a full refund until 8pm.', moment: <MomentPay />, dark: false },
    { time: snapshot, title: 'Tonight’s route is planned.', text: 'Your stop goes to a nearby approved driver, who accepts it before the shift starts at 8pm.', moment: <MomentPlanned snapshot={snapshot} />, dark: true },
    { time: '8pm – 6am', title: 'Collected at your gate.', text: 'Your driver navigates straight to your pin and takes a photo at pickup. You get an alert.', moment: <MomentCollected />, dark: true },
    { time: 'By morning', title: 'Unload verified.', text: 'The load is checked in at a licensed disposal site. Your order shows it’s done, with proof at every step.', moment: <MomentUnloaded />, dark: false },
  ]

  return (
    <section id="how" aria-labelledby="tour-title" className="tour relative scroll-mt-16 overflow-hidden">
      <div className="relative mx-auto max-w-6xl px-4 pt-24 sm:px-6 sm:pt-28">
        <div className="tour-text mx-auto max-w-2xl text-center">
          <h2 id="tour-title" className="text-[clamp(2rem,4vw,3.25rem)] font-bold leading-[1.04] tracking-[-0.04em]">
            One pickup, from your pin to the disposal site.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-ink-2">Every step happens on a schedule you can see, and every step leaves proof.</p>
        </div>
      </div>

      {/* The chapters scroll like any section. The sky changes only in the gaps between them: evening for the first
          three, night for the next two (with stars and the moon), dawn for the last. */}
      <div className="relative mt-16 sm:mt-20">
        {/* The route: a faint dashed road, the drawn part, and the truck driving it at screen height. */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[35px] z-[4] w-0 sm:left-[43px] md:left-1/2">
          <svg className="tour-route absolute inset-y-0 -left-[3px] h-full w-[6px] overflow-visible" preserveAspectRatio="none" viewBox="0 0 6 100">
            <path d="M3 0 V100" stroke="currentColor" className="text-line-strong" strokeOpacity={0.7} strokeWidth="2" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" fill="none" />
            <path d="M3 0 V100" pathLength={1} stroke="var(--color-highlight)" className="draw" strokeWidth="4" strokeLinecap="round" vectorEffect="non-scaling-stroke" fill="none" />
          </svg>
          <span className="tour-truck absolute -left-[17px] top-0 grid size-[34px] -translate-y-1/2 place-items-center rounded-[12px] bg-hero text-highlight shadow-lift ring-4 ring-highlight/25">
            <Truck className="size-4" />
          </span>
        </div>

        <div className="relative">
          <div className="pb-28 sm:pb-36">
            <ol className="grid gap-20 sm:gap-28">
              {chapters.slice(0, 3).map((c, i) => (
                <ChapterRow key={c.title} c={c} i={i} />
              ))}
            </ol>
          </div>
          <div
            className="relative py-40 sm:py-48"
            style={{ background: 'linear-gradient(180deg, transparent 0, var(--tour-dusk) 120px, #0e1d14 200px, #0e1d14 calc(100% - 200px), var(--tour-first-light) calc(100% - 110px), var(--tour-dawn) 100%)' }}
          >
            <span aria-hidden className="stars-layer pointer-events-none absolute inset-x-0 bottom-40 top-40 opacity-80" />
            <span aria-hidden className="tour-drift pointer-events-none absolute right-[8%] top-48 hidden size-14 md:block rotate-[-20deg] rounded-full shadow-[-14px_8px_0_0_#eadba8]" />
            <ol className="relative grid gap-20 sm:gap-28" start={4}>
              {chapters.slice(3, 5).map((c, i) => (
                <ChapterRow key={c.title} c={c} i={i + 3} />
              ))}
            </ol>
          </div>
          <div className="relative overflow-hidden pb-28 pt-10 sm:pb-36" style={{ background: 'linear-gradient(180deg, var(--tour-dawn) 0, var(--tour-dawn) 70%, var(--color-canvas) 100%)' }}>
            <span aria-hidden className="pointer-events-none absolute -bottom-80 left-1/2 size-[680px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(246_200_120/0.45),transparent_65%)]" />
            <ol className="relative" start={6}>
              <ChapterRow c={chapters[5]} i={5} />
            </ol>
          </div>
        </div>
      </div>
    </section>
  )
}
