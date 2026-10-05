import Link from 'next/link'
import { AlertCircle, Home, Truck } from 'lucide-react'
import Logo from '@/components/Logo'

// The frame shared by sign-in and create-account: the three workspaces on the left, the form on the right
// (stacked on phones).

// Text field style for the auth forms.
export const AUTH_FIELD =
  'block w-full rounded-control border border-line-strong bg-surface px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-3 focus:border-ops focus:outline-none focus:ring-3 focus:ring-ops/15'

// The dark, role-neutral primary button used on shared pages (no single role owns them).
export const AUTH_BUTTON =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control bg-night font-semibold text-white transition hover:bg-night-3 disabled:cursor-not-allowed disabled:opacity-60'

const WORKSPACES = [
  { name: 'Customer', text: 'Book, pay and track your pickups', icon: Home, chip: 'bg-customer text-white' },
  { name: 'Driver', text: 'Your night’s stops and earnings', icon: Truck, chip: 'bg-driver text-night' },
]

export function ErrorLine({ text }: { text: string }) {
  return (
    <p role="alert" className={text ? 'flex items-start gap-2 text-sm text-danger' : 'sr-only'}>
      {text && <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />}
      {text}
    </p>
  )
}

// Sign in / Create account switch.
export function AuthTabs({ current }: { current: 'signin' | 'signup' }) {
  const tab = 'flex-1 rounded-[8px] py-2 text-center'
  const on = `${tab} bg-surface text-ink shadow-card`
  const off = `${tab} text-ink-3 hover:text-ink`
  return (
    <nav className="flex rounded-control bg-canvas p-1 text-sm font-semibold" aria-label="Account">
      {current === 'signin' ? (
        <span aria-current="page" className={on}>Sign in</span>
      ) : (
        <Link href="/login" className={off}>Sign in</Link>
      )}
      {current === 'signup' ? (
        <span aria-current="page" className={on}>Create account</span>
      ) : (
        <Link href="/signup" className={off}>Create account</Link>
      )}
    </nav>
  )
}

export default function AuthShell({ children, agreeVerb }: { children: React.ReactNode; agreeVerb: string }) {
  return (
    <div data-surface="new" className="min-h-dvh bg-canvas lg:grid lg:place-items-center lg:p-8">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden bg-surface lg:min-h-[640px] lg:grid-cols-[1fr_1.1fr] lg:rounded-[24px] lg:shadow-lift lg:ring-1 lg:ring-line">
        <aside className="relative bg-night px-6 py-8 text-night-ink sm:px-10 lg:py-12">
          <Link href="/" aria-label="Trashit home" className="inline-flex">
            <Logo height={30} onDark />
          </Link>
          <p className="mt-8 text-[clamp(1.6rem,3vw,2.2rem)] font-bold leading-tight tracking-[-0.03em] lg:mt-16">
            One account.
            <br />
            The right workspace.
          </p>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-night-muted">
            Sign in once. Trashit opens the workspace that matches your account.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2 sm:hidden" aria-label="Workspaces">
            {WORKSPACES.map(({ name, icon: Icon, chip }) => (
              <li key={name} className="flex items-center gap-2 rounded-full bg-night-2 py-1 pl-1 pr-3 text-sm font-medium ring-1 ring-night-line">
                <span className={`grid size-7 place-items-center rounded-full ${chip}`}>
                  <Icon aria-hidden className="size-3.5" />
                </span>
                {name}
              </li>
            ))}
          </ul>
          <ul className="mt-8 hidden gap-3 sm:grid">
            {WORKSPACES.map(({ name, text, icon: Icon, chip }) => (
              <li key={name} className="flex items-center gap-3.5 rounded-card bg-night-2 p-3.5 ring-1 ring-night-line">
                <span className={`grid size-10 shrink-0 place-items-center rounded-[10px] ${chip}`}>
                  <Icon aria-hidden className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold">{name}</span>
                  <span className="block text-sm text-night-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </aside>
        <main className="px-6 py-10 sm:px-10 lg:flex lg:flex-col lg:justify-center lg:py-12">
          <div className="mx-auto w-full max-w-sm">{children}</div>
          <p className="mx-auto mt-10 w-full max-w-sm text-xs text-ink-3">
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
        </main>
      </div>
    </div>
  )
}
