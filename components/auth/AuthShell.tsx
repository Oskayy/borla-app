import Link from 'next/link'
import { AlertCircle, ArrowLeft, Home, Truck } from 'lucide-react'
import Logo from '@/components/Logo'

// The frame shared by sign-in, create-account and the password pages, as designed: a night panel on the left
// (on phones, a short band on top) and the form on the warm ground.

// Text field style for the auth forms.
export const AUTH_FIELD =
  'block h-[52px] w-full rounded-control border border-line-strong bg-surface px-4 text-[16px] text-ink transition-[border-color,box-shadow] placeholder:text-ink-3 focus:border-action-deep focus:outline-none focus:ring-4 focus:ring-action/30 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15'

// The main button on these pages.
export const AUTH_BUTTON =
  'press group inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-action text-[16px] font-bold text-on-action shadow-lift transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-3 disabled:shadow-none'

const WORKSPACES = [
  { name: 'Customers', text: 'Book, pay and follow your pickups', icon: Home, chip: 'bg-[#9be07a] text-[#0e1511]' },
  { name: 'Drivers', text: 'Your night’s stops and earnings', icon: Truck, chip: 'bg-[#d9a06b] text-[#1b140c]' },
]

export function ErrorLine({ text }: { text: string }) {
  return (
    <p role="alert" className={text ? 'anim-note flex items-start gap-2 text-sm font-medium text-danger' : 'sr-only'}>
      {text && <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />}
      {text}
    </p>
  )
}

// Sign in / Create account switch.
export function AuthTabs({ current }: { current: 'signin' | 'signup' }) {
  const tab = 'flex min-h-11 flex-1 items-center justify-center rounded-full text-center transition-colors duration-200'
  const on = `${tab} bg-selected text-on-selected shadow-card`
  const off = `${tab} text-ink-3 hover:text-ink`
  return (
    <nav className="flex rounded-full bg-surface p-1 text-[15px] font-semibold ring-1 ring-line" aria-label="Account">
      {current === 'signin' ? (
        <span aria-current="page" className={on}>
          Sign in
        </span>
      ) : (
        <Link href="/login" className={off}>
          Sign in
        </Link>
      )}
      {current === 'signup' ? (
        <span aria-current="page" className={on}>
          Create account
        </span>
      ) : (
        <Link href="/signup" className={off}>
          Create account
        </Link>
      )}
    </nav>
  )
}

export default function AuthShell({ children, agreeVerb }: { children: React.ReactNode; agreeVerb?: string }) {
  return (
    <div data-surface="new" className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      {/* The night panel */}
      <aside data-spot className="spotlight relative isolate overflow-hidden bg-[#163320] px-6 pb-8 pt-6 text-white sm:px-10 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <span aria-hidden className="stars-layer absolute inset-0 -z-10 opacity-60" />
        <span aria-hidden className="hero-glow absolute inset-0 -z-10" />
        <span aria-hidden className="absolute right-8 top-8 size-11 rotate-[-20deg] rounded-full shadow-[-11px_6px_0_0_#eadba8] lg:right-14 lg:top-12 lg:size-14 lg:shadow-[-14px_8px_0_0_#eadba8]" />
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Trashit home" className="inline-flex">
            <Logo height={30} onDark />
          </Link>
        </div>
        <div className="mt-8 lg:mt-0">
          <p className="max-w-[12em] text-[clamp(1.7rem,3.6vw,3rem)] font-bold leading-[1.04] tracking-[-0.04em]">Your bin, cleared overnight.</p>
          <p className="mt-3 hidden max-w-sm text-[17px] leading-relaxed text-[#bfd8c3] sm:block">
            Sign in once. Trashit opens the right workspace for your account.
          </p>
        </div>
        <ul className="mt-6 hidden gap-3 lg:grid" aria-label="Workspaces">
          {WORKSPACES.map(({ name, text, icon: Icon, chip }) => (
            <li key={name} className="flex items-center gap-3.5 rounded-[18px] bg-white/[0.06] p-3.5 ring-1 ring-white/10">
              <span className={`grid size-10 shrink-0 place-items-center rounded-[12px] ${chip}`}>
                <Icon aria-hidden className="size-5" />
              </span>
              <span>
                <span className="block font-semibold">{name}</span>
                <span className="block text-sm text-[#bfd8c3]">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </aside>

      {/* The form */}
      <main className="relative px-5 py-9 sm:px-10 lg:flex lg:min-h-dvh lg:flex-col lg:justify-center lg:py-14">
        <Link href="/" className="group mb-6 hidden min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-ink-2 hover:text-ink lg:absolute lg:left-10 lg:top-8 lg:mb-0 lg:inline-flex">
          <ArrowLeft aria-hidden className="size-4 transition-transform group-hover:-translate-x-0.5" /> Trashit home
        </Link>
        <div className="anim-rise mx-auto w-full max-w-[420px]">{children}</div>
        {agreeVerb && (
          <p className="mx-auto mt-10 w-full max-w-[420px] text-center text-xs text-ink-3">
            By {agreeVerb} you agree to Trashit&apos;s{' '}
            <Link href="/terms" className="underline underline-offset-2 hover:text-ink">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy-policy" className="underline underline-offset-2 hover:text-ink">
              Privacy Policy
            </Link>
            .
          </p>
        )}
      </main>
    </div>
  )
}
