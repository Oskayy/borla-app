'use client'

import { useEffect, useState } from 'react'
import { Camera, Check, CircleCheck, Pause, Play, Smartphone, Truck } from 'lucide-react'
import { useClientValue } from '@/lib/use-client-value'

// The landing hero: how one pickup works, as a looping animated scene.
// 1 open the app, 2 book and pay, 3 a driver is assigned, 4 collected at the gate, 5 unloaded at a disposal site.
// Auto-plays (pausable); with reduced motion it waits for the visitor to step through. All data shown is an example.

const STEPS = [
  { label: 'Open Trashit', caption: 'Open Trashit on your phone. Your gate pin is already saved.' },
  { label: 'Book and pay', caption: 'Choose your bins and pay with MoMo. Book by 6pm for tonight.' },
  { label: 'Driver assigned', caption: 'Trashit gives your stop to a nearby approved driver, who accepts it.' },
  { label: 'Collected', caption: 'The driver collects your bins at the gate and takes a photo.' },
  { label: 'Unloaded', caption: 'The load is checked in at a licensed disposal site. Done.' },
] as const

const STEP_MS = 3600

// Scene geometry (viewBox 560 x 470).
const DEPOT = { x: 86, y: 404 }
const GATE = { x: 214, y: 214 }
const SITE = { x: 446, y: 352 }
const DISPATCH = { x: 304, y: 70 }

const TRUCK_AT = [DEPOT, DEPOT, DEPOT, GATE, SITE]

function usePrefersReducedMotion() {
  return useClientValue(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, false)
}

export default function HeroFlow() {
  const reduced = usePrefersReducedMotion()
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)
  const playing = !paused && !reduced

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') setStep((s) => (s + 1) % STEPS.length)
    }, STEP_MS)
    return () => clearInterval(t)
  }, [playing])

  const truck = TRUCK_AT[step]
  const move = reduced ? 'none' : 'transform 1.7s cubic-bezier(0.65, 0, 0.35, 1)'

  return (
    <figure className="relative isolate overflow-hidden rounded-[22px] bg-night text-night-ink shadow-lift ring-1 ring-night-line">
      <div className="relative">
        <svg viewBox="0 0 560 470" className="block h-auto w-full" role="img" aria-labelledby="flow-title">
          <title id="flow-title">
            How a Trashit pickup works: book on your phone, a driver is assigned, your bins are collected at the gate, and
            the load is unloaded at a licensed disposal site.
          </title>
          <defs>
            <radialGradient id="flow-glow-g" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#3fd99a" stopOpacity="0.35" />
              <stop offset="1" stopColor="#3fd99a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="flow-glow-i" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#8b84ff" stopOpacity="0.4" />
              <stop offset="1" stopColor="#8b84ff" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* City grid */}
          <g stroke="#24344f" strokeWidth="1.2" fill="none">
            {[70, 140, 210, 280, 350, 420].map((y) => (
              <path key={`h${y}`} d={`M0 ${y} C 150 ${y - 10}, 320 ${y + 12}, 560 ${y - 6}`} />
            ))}
            {[80, 170, 260, 350, 440, 520].map((x) => (
              <path key={`v${x}`} d={`M${x} 0 C ${x + 12} 160, ${x - 14} 300, ${x + 6} 470`} />
            ))}
          </g>

          {/* Route: depot to gate, gate to disposal site; each part draws as the truck drives it */}
          <path d={`M${DEPOT.x} ${DEPOT.y} L${GATE.x} ${GATE.y} L${SITE.x} ${SITE.y}`} stroke="#f0a43a" strokeOpacity="0.12" strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path
            d={`M${DEPOT.x} ${DEPOT.y} L${GATE.x} ${GATE.y}`}
            pathLength={1}
            stroke="#f0a43a"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="1"
            style={{ strokeDashoffset: step >= 3 ? 0 : 1, transition: reduced ? 'none' : 'stroke-dashoffset 1.7s cubic-bezier(0.65,0,0.35,1)' }}
          />
          <path
            d={`M${GATE.x} ${GATE.y} L${SITE.x} ${SITE.y}`}
            pathLength={1}
            stroke="#f0a43a"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="1"
            style={{ strokeDashoffset: step >= 4 ? 0 : 1, transition: reduced ? 'none' : 'stroke-dashoffset 1.7s cubic-bezier(0.65,0,0.35,1)' }}
          />

          {/* Dispatch sends the stop to the driver */}
          <circle cx={DISPATCH.x} cy={DISPATCH.y} r="34" fill="url(#flow-glow-i)" />
          <g>
            <rect x={DISPATCH.x - 15} y={DISPATCH.y - 15} width="30" height="30" rx="9" fill="#4b40e0" stroke="#a7a2ff" strokeWidth="2" />
            <path d={`M${DISPATCH.x - 7} ${DISPATCH.y - 5} h14 M${DISPATCH.x - 7} ${DISPATCH.y} h14 M${DISPATCH.x - 7} ${DISPATCH.y + 5} h9`} stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
          </g>
          <path
            d={`M${DISPATCH.x} ${DISPATCH.y + 16} C ${DISPATCH.x - 40} 200, ${DEPOT.x + 80} 300, ${DEPOT.x + 14} ${DEPOT.y - 24}`}
            stroke="#a7a2ff"
            strokeWidth="2.5"
            fill="none"
            strokeDasharray="6 8"
            className={step === 2 && !reduced ? 'flow-signal' : undefined}
            style={{ opacity: step === 2 ? 1 : 0, transition: 'opacity 0.4s' }}
          />

          {/* The house and its gate */}
          <circle cx={GATE.x - 70} cy={GATE.y - 40} r="70" fill="url(#flow-glow-g)" />
          <g>
            <path d={`M${GATE.x - 116} ${GATE.y - 52} L${GATE.x - 70} ${GATE.y - 92} L${GATE.x - 24} ${GATE.y - 52}`} fill="#12825a" stroke="#3fd99a" strokeWidth="2" strokeLinejoin="round" />
            <rect x={GATE.x - 108} y={GATE.y - 54} width="76" height="58" rx="3" fill="#16233a" stroke="#3fd99a" strokeWidth="2" />
            <rect x={GATE.x - 96} y={GATE.y - 40} width="16" height="14" rx="2" fill="#f0c66e" opacity="0.85" />
            <rect x={GATE.x - 62} y={GATE.y - 26} width="16" height="30" rx="2" fill="#0e1726" stroke="#3fd99a" strokeWidth="1.5" />
            {/* gate pin */}
            <circle cx={GATE.x - 6} cy={GATE.y - 2} r="7" fill="#12825a" stroke="#3fd99a" strokeWidth="2" />
            <circle cx={GATE.x - 6} cy={GATE.y - 2} r="2.4" fill="#e8edf5" />
          </g>
          {/* The bin: out at the gate until the driver collects it */}
          <g
            style={{
              transformBox: 'fill-box',
              transformOrigin: 'center bottom',
              transform: step >= 3 ? 'scale(0)' : 'scale(1)',
              opacity: step >= 3 ? 0 : 1,
              transition: reduced ? 'none' : `transform 0.5s ease ${step >= 3 ? '1.75s' : '0s'}, opacity 0.5s ease ${step >= 3 ? '1.75s' : '0s'}`,
            }}
          >
            <rect x={GATE.x + 10} y={GATE.y - 20} width="18" height="22" rx="3" fill="#12825a" stroke="#3fd99a" strokeWidth="1.5" />
            <rect x={GATE.x + 8} y={GATE.y - 24} width="22" height="5" rx="2" fill="#3fd99a" />
          </g>

          {/* The disposal site */}
          <circle cx={SITE.x + 40} cy={SITE.y + 24} r="74" fill="url(#flow-glow-i)" />
          <g>
            <path d={`M${SITE.x + 8} ${SITE.y + 6} L${SITE.x + 44} ${SITE.y - 22} L${SITE.x + 84} ${SITE.y + 6} Z`} fill="#4b40e0" stroke="#a7a2ff" strokeWidth="2" strokeLinejoin="round" />
            <rect x={SITE.x + 14} y={SITE.y + 6} width="64" height="44" rx="3" fill="#16233a" stroke="#a7a2ff" strokeWidth="2" />
            <rect x={SITE.x + 30} y={SITE.y + 20} width="32" height="30" rx="2" fill="#0e1726" stroke="#a7a2ff" strokeWidth="1.5" />
          </g>
          {/* Unload verified */}
          <g
            style={{
              transformBox: 'fill-box',
              transformOrigin: 'center',
              transform: step >= 4 ? 'scale(1)' : 'scale(0.4)',
              opacity: step >= 4 ? 1 : 0,
              transition: reduced ? 'none' : `transform 0.5s cubic-bezier(0.16,1,0.3,1) ${step >= 4 ? '1.8s' : '0s'}, opacity 0.4s ease ${step >= 4 ? '1.8s' : '0s'}`,
            }}
          >
            <circle cx={SITE.x + 82} cy={SITE.y - 26} r="15" fill="#4b40e0" stroke="#fff" strokeWidth="2.5" />
            <path d={`M${SITE.x + 75} ${SITE.y - 26} l5 5 l9 -10`} stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>

          {/* The driver's vehicle */}
          <g style={{ transform: `translate(${truck.x}px, ${truck.y}px)`, transition: move }}>
            <g transform="translate(-24 -26)">
              <rect x="0" y="6" width="30" height="22" rx="4" fill="#f0a43a" />
              <path d="M30 12 h10 l8 9 v7 h-18 z" fill="#f5b85c" />
              <rect x="34" y="14" width="7" height="6" rx="1" fill="#0e1726" opacity="0.7" />
              <circle cx="10" cy="30" r="5" fill="#0e1726" stroke="#f0a43a" strokeWidth="2.5" />
              <circle cx="38" cy="30" r="5" fill="#0e1726" stroke="#f0a43a" strokeWidth="2.5" />
            </g>
            {/* Photo flash at the gate */}
            {step === 3 && !reduced && <circle key="flash" r="30" fill="#ffffff" className="flow-flash" />}
          </g>
        </svg>

        {/* Labels set as text over the scene */}
        <span className="absolute left-[15%] top-[56%] inline-flex items-center gap-1.5 rounded-full bg-night/85 px-2.5 py-1 text-[11px] font-medium ring-1 ring-customer/50 sm:text-xs">
          Your gate
        </span>
        <span className="absolute left-[44%] top-[2%] inline-flex items-center gap-1.5 rounded-full bg-night/85 px-2.5 py-1 text-[11px] font-medium ring-1 ring-ops/60 sm:text-xs">
          Trashit dispatch
        </span>
        <span className="absolute right-[3%] top-[87%] inline-flex items-center gap-1.5 rounded-full bg-night/85 px-2.5 py-1 text-[11px] font-medium ring-1 ring-ops/60 sm:text-xs">
          Licensed disposal site
        </span>
        <span
          className="absolute left-[3%] top-[73%] inline-flex items-center gap-1.5 rounded-full bg-night/85 px-2.5 py-1 text-[11px] font-medium ring-1 ring-driver/60 transition-opacity duration-300 sm:text-xs"
          style={{ opacity: step === 2 ? 1 : 0 }}
          aria-hidden={step !== 2}
        >
          <Truck aria-hidden className="size-3.5 text-driver" /> Stop accepted
        </span>
        <span
          className="absolute left-[40%] top-[33%] inline-flex items-center gap-1.5 rounded-full bg-night/85 px-2.5 py-1 text-[11px] font-medium ring-1 ring-driver/60 transition-opacity duration-300 sm:text-xs"
          style={{ opacity: step === 3 ? 1 : 0, transitionDelay: step === 3 ? '1.8s' : '0s' }}
          aria-hidden={step !== 3}
        >
          <Camera aria-hidden className="size-3.5 text-driver" /> Photo taken
        </span>

        {/* The customer's phone: what they see at each step */}
        <div className="absolute right-[4%] top-[14%] w-[34%] max-w-[168px] rounded-[20px] bg-[#05080f] p-1.5 shadow-lift ring-1 ring-night-line">
          <div className="rounded-[15px] bg-surface px-2.5 pb-3 pt-2.5 text-ink">
            <p className="flex items-center justify-between text-[9px] font-semibold text-ink-3 sm:text-[10px]">
              <span>Trashit</span>
              <span className="rounded-full bg-customer-wash px-1.5 py-px text-customer-deep">Example</span>
            </p>
            {step === 0 && (
              <div key="s0" className="flow-screen">
                <p className="mt-2 text-[11px] font-semibold leading-tight sm:text-[13px]">Good evening</p>
                <p className="mt-0.5 text-[9px] text-ink-3 sm:text-[10px]">Gate pin saved</p>
                <span className="mt-2.5 flex items-center justify-center gap-1 rounded-[8px] bg-customer py-1.5 text-[10px] font-semibold text-white sm:text-[11px]">
                  <Smartphone aria-hidden className="size-3" /> Book a pickup
                </span>
              </div>
            )}
            {step === 1 && (
              <div key="s1" className="flow-screen">
                <p className="mt-2 text-[11px] font-semibold leading-tight sm:text-[13px]">2 × 60 L bins</p>
                <p className="mt-0.5 text-[9px] text-ink-3 sm:text-[10px]">Tonight, 8pm–6am</p>
                <p className="mt-1.5 text-[13px] font-bold tabular-nums sm:text-[15px]">GHS 50.00</p>
                <span className="mt-2 flex items-center justify-center gap-1 rounded-[8px] bg-customer py-1.5 text-[10px] font-semibold text-white sm:text-[11px]">
                  <Check aria-hidden className="size-3" /> Paid with MoMo
                </span>
              </div>
            )}
            {step >= 2 && (
              <ol key="s2" className="flow-screen mt-2 grid gap-1">
                {['Booked', 'Driver assigned', 'Collected', 'Unloaded'].map((s, i) => {
                  const done = i <= step - 1
                  return (
                    <li key={s} className={`flex items-center gap-1 text-[9px] font-medium sm:text-[10px] ${done ? 'text-ink' : 'text-ink-3'}`}>
                      {done ? (
                        <CircleCheck aria-hidden className={`size-3 shrink-0 ${i === 3 ? 'text-ops' : i === 0 ? 'text-customer' : 'text-driver-deep'}`} />
                      ) : (
                        <span aria-hidden className="size-3 shrink-0 rounded-full border border-line-strong" />
                      )}
                      {s}
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </div>
      </div>

      {/* Steps, caption and pause */}
      <figcaption className="border-t border-night-line bg-night-2 px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-3">
          <ol className="flex flex-1 items-center gap-1.5" aria-label="Steps">
            {STEPS.map((s, i) => (
              <li key={s.label} className="flex-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep(i)
                    setPaused(true)
                  }}
                  aria-current={i === step ? 'step' : undefined}
                  aria-label={`Step ${i + 1}: ${s.label}`}
                  className="group block w-full py-2"
                >
                  <span className={`block h-1.5 rounded-full transition-colors ${i <= step ? (i >= 2 ? (i === 4 ? 'bg-ops' : i === 2 ? 'bg-[#8b84ff]' : 'bg-driver') : 'bg-customer-glow') : 'bg-night-line group-hover:bg-night-3'}`} />
                </button>
              </li>
            ))}
          </ol>
          {!reduced && (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? 'Play the animation' : 'Pause the animation'}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-night-3 text-night-ink ring-1 ring-night-line transition hover:bg-night-line"
            >
              {paused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}
            </button>
          )}
        </div>
        <p className="mt-1 text-sm" aria-live={playing ? 'off' : 'polite'}>
          <span className="font-semibold text-night-ink">
            {step + 1}. {STEPS[step].label}.
          </span>{' '}
          <span className="text-night-muted">{STEPS[step].caption}</span>
        </p>
      </figcaption>
    </figure>
  )
}
