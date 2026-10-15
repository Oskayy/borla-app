import { Check, Flag } from 'lucide-react'
import s from './story.module.css'

// The landing page's "one night" tour from the approved design: a little town in 3D holds on screen while you scroll,
// and the camera, sky, captions and booking card follow one pickup from the gate pin to the disposal site. Everything
// is driven by the scroll (CSS only), so the page never stops moving. A still list shows instead without scroll-driven
// animation or with reduced motion. The people and numbers in the card are an example.

const ROADS = [
  [0, 300, 900, 26],
  [0, 520, 900, 18],
  [330, 0, 26, 640],
  [640, 0, 18, 640],
]
const BLOCKS = [
  [40, 40, 110, 80, 22],
  [190, 30, 100, 90, 34],
  [390, 40, 90, 70, 20],
  [500, 30, 110, 80, 44],
  [690, 40, 90, 70, 26],
  [800, 160, 70, 90, 18],
  [40, 170, 120, 90, 28],
  [190, 180, 100, 80, 16],
  [390, 150, 70, 110, 30],
  [480, 180, 120, 80, 22],
  [690, 180, 90, 90, 36],
  [40, 360, 100, 120, 20],
  [180, 370, 110, 100, 32],
  [690, 360, 90, 120, 24],
  [800, 380, 70, 100, 16],
  [180, 560, 120, 60, 18],
  [390, 560, 220, 60, 22],
  [690, 560, 160, 60, 14],
]
const LAMPS = [
  [300, 290],
  [420, 290],
  [560, 290],
  [720, 290],
  [320, 420],
  [320, 200],
  [630, 140],
  [630, 440],
  [140, 510],
  [500, 510],
]

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ')
const tick = <Check aria-hidden className="size-4" strokeWidth={2.8} />

function storyChapters(snapshot: string) {
  return [
    {
      time: `Before ${snapshot}`,
      title: 'Drop a pin on your gate.',
      text: 'Not your street. Your gate. You place it on a satellite map, so your driver finds you in the dark.',
    },
    {
      time: `Before ${snapshot}`,
      title: 'Choose your bins.',
      text: '30, 60 or 120 litres. The price is worked out for your area and shown in full before you pay.',
    },
    {
      time: `Before ${snapshot}`,
      title: 'Pay the way you already do.',
      text: 'MTN MoMo, Telecel Cash, AirtelTigo Money or a card, through Paystack. Cancel for a full refund until 8pm.',
    },
    {
      time: snapshot,
      title: 'Tonight’s route is planned.',
      text: 'Your stop goes to a nearby approved driver, who accepts it before the shift starts at 8pm.',
    },
    {
      time: '8pm – 6am',
      title: 'Collected at your gate.',
      text: 'Your driver navigates straight to your pin and takes a photo at pickup. You get an alert.',
    },
    {
      time: 'By morning',
      title: 'Unload verified.',
      text: 'The load is checked in at a licensed disposal site. Your order shows it’s done, with proof at every step.',
    },
  ]
}

function Plane() {
  return (
    <div className={cx(s.plane, s.sc)}>
      {ROADS.map(([x, y, w, h]) => (
        <span key={`r${x}-${y}`} className={s.rd} style={{ left: x, top: y, width: w, height: h }} />
      ))}
      <span className={s.pk} style={{ left: 390, top: 360, width: 220, height: 130 }} />
      {BLOCKS.map(([x, y, w, h, z]) => (
        <span
          key={`b${x}-${y}`}
          className={s.bk}
          style={{
            left: x,
            top: y,
            width: w,
            height: h,
            boxShadow: `-${Math.round(z * 0.35)}px ${Math.round(z * 0.75)}px 0 var(--p-shadow)`,
          }}
        />
      ))}
      <span className={cx(s.shade, s.sc)} />
      {LAMPS.map(([x, y]) => (
        <span key={`l${x}-${y}`} className={cx(s.lamp, s.sc)} style={{ left: x, top: y }} />
      ))}
      <svg width="900" height="640" viewBox="0 0 900 640" aria-hidden>
        <path className={cx(s.route, s.r1, s.sc)} pathLength={1} stroke="#9be07a" d="M 90 529 H 343 V 313 H 470" />
        <path className={cx(s.route, s.r2, s.sc)} pathLength={1} stroke="#9cc9e4" d="M 470 313 H 649 V 80 H 790" />
      </svg>
      <span className={cx(s.truck, s.sc)} />
      <span className={s.stand} style={{ left: 470, top: 300 }}>
        <span className={s.up}>
          <span className={cx(s.ringp, s.sc)} />
          <span className={cx(s.pinDrop, s.sc)}>
            <span className={s.pin} />
          </span>
          <span className={cx(s.tagc, s.sc)}>Your gate</span>
        </span>
      </span>
      <span className={cx(s.stand, s.site, s.sc)} style={{ left: 800, top: 70 }}>
        <span className={s.up}>
          <span className={s.flag}>
            <Flag aria-hidden className="size-4" strokeWidth={2.4} />
          </span>
        </span>
      </span>
    </div>
  )
}

function Card({ snapshot }: { snapshot: string }) {
  return (
    <div className={cx(s.card, s.sc)}>
      <div className={cx(s.panel, s.p1, s.sc)}>
        <p className={s.k}>Step 2 of 4 · example</p>
        <h4>Choose your bins</h4>
        <div className={s.prow}>
          <span>
            Small<small>30 L</small>
          </span>
          <span className={s.ct}>0</span>
        </div>
        <div className={cx(s.prow, s.m1, s.sc)}>
          <span>
            Medium<small>60 L</small>
          </span>
          <span className={cx(s.ct, s.cnt, s.sc)} />
        </div>
        <div className={s.prow}>
          <span>
            Large<small>120 L</small>
          </span>
          <span className={s.ct}>0</span>
        </div>
        <p className={s.note}>Your price for your area shows before you pay.</p>
      </div>
      <div className={cx(s.panel, s.p2, s.sc)}>
        <p className={s.k}>Step 4 of 4</p>
        <h4>Pay for tonight</h4>
        <div className={cx(s.prow, s.on)}>
          <span>MTN MoMo</span>
          <span className={cx(s.chip, s.ok)}>Selected</span>
        </div>
        <div className={s.prow}>
          <span>Telecel Cash</span>
        </div>
        <div className={s.prow}>
          <span>Card</span>
        </div>
        <div className={s.paybtn}>
          <span>Pay with MoMo</span>
          <span className={cx(s.pay2, s.sc)}>{tick} Paid</span>
        </div>
      </div>
      <div className={cx(s.panel, s.p3, s.sc)}>
        <p className={s.k}>Tonight · 8pm – 6am</p>
        <h4>Your stop is planned</h4>
        <span className={cx(s.chip, s.info)}>Planned at {snapshot}</span>
        <div className={s.prow}>
          <span>
            Your driver<small>Approved driver</small>
          </span>
          <span className={cx(s.chip, s.ok, s.acc, s.sc)}>Accepted</span>
        </div>
        <p className={s.note}>Put your bins out by 8pm. We’ll alert you when they’re collected.</p>
      </div>
      <div className={cx(s.panel, s.p4, s.sc)}>
        <p className={s.k}>During the night</p>
        <h4>Collected at your gate</h4>
        <div className={s.photo}>
          <span className={cx(s.fl, s.sc)} />
        </div>
        <span className={cx(s.chip, s.ok)}>{tick} Photo and GPS saved</span>
      </div>
      <div className={cx(s.panel, s.p5, s.sc)}>
        <p className={s.k}>Next morning</p>
        <h4>Done. Proof at every step.</h4>
        <ol className={s.steps4}>
          {['Paid', 'Accepted by your driver', 'Collected at your gate', 'Unloaded at a licensed site'].map((t, i) => (
            <li key={t}>
              <span className={cx(s.tick, [s.t1, s.t2, s.t3, s.t4][i], s.sc)}>{tick}</span>
              {t}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

export default function NightStory({ snapshot }: { snapshot: string }) {
  const chapters = storyChapters(snapshot)
  return (
    <>
      <section id="how" aria-label="How it works: one pickup, from your pin to the disposal site" className={cx(s.story, 'scroll-mt-0')}>
        <div data-spot className={cx(s.stage, s.sc)}>
          <div aria-hidden className={s.sky}>
            <span className={cx(s.stars, 'stars-layer', s.sc)} />
            <span className={cx(s.moon, s.sc)} />
            <span className={cx(s.sun, s.sc)} />
          </div>
          <div className={s.capCol}>
            <div aria-hidden className={s.rail}>
              {chapters.map((c, i) => (
                <i key={c.title} className={cx([s.d0, s.d1, s.d2, s.d3, s.d4, s.d5][i], s.sc)} />
              ))}
            </div>
            <ol className={s.caps}>
              {chapters.map((c, i) => (
                <li key={c.title} className={cx(s.cap, [s.c0, s.c1, s.c2, s.c3, s.c4, s.c5][i], s.sc)}>
                  <div className={s.capIn}>
                    <p className={s.num}>0{i + 1} / 06</p>
                    <span className={s.tm}>{c.time}</span>
                    <h3>{c.title}</h3>
                    <p>{c.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div aria-hidden className={s.world}>
            <div className={s.cam}>
              <Plane />
            </div>
            <Card snapshot={snapshot} />
            <div className={cx(s.alert, s.sc)}>
              <span className={s.ai}>{tick}</span>
              <span>
                <b>Your bins were collected</b>
                <small>Photo saved · see your order</small>
              </span>
            </div>
          </div>
          <span aria-hidden className={s.dim} />
        </div>
      </section>

      <section id="how-still" aria-labelledby="how-still-title" className={cx(s.static, 'px-4 py-20 sm:px-6')}>
        <div className="mx-auto max-w-6xl">
          <h2 id="how-still-title" className="max-w-2xl text-[clamp(2rem,4.4vw,3.2rem)] font-bold leading-[1.04] tracking-[-0.04em]">
            From gate pin to cleared bin, in one night.
          </h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {chapters.map((c, i) => (
              <li key={c.title} className="rounded-card bg-surface p-6 shadow-card ring-1 ring-line/70">
                <span className="text-sm font-semibold text-ink-3">
                  0{i + 1} · {c.time}
                </span>
                <b className="mt-2 block text-lg tracking-tight">{c.title}</b>
                <p className="mt-2 leading-relaxed text-ink-2">{c.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  )
}

export const storyAfter = s.after
