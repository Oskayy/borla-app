'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Check, Circle, Home, MailCheck, Truck } from 'lucide-react'
import PasswordInput from '@/components/PasswordInput'
import AuthShell, { AUTH_BUTTON, AUTH_FIELD, AuthTabs, ErrorLine } from '@/components/auth/AuthShell'
import { useClientValue } from '@/lib/use-client-value'
import { draftRaw } from '@/lib/booking-draft'

function checkStrength(password: string) {
  return [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'One uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', pass: /[a-z]/.test(password) },
    { label: 'One number', pass: /[0-9]/.test(password) },
    { label: 'One symbol (e.g. ! @ # $)', pass: /[^A-Za-z0-9]/.test(password) },
  ]
}

// The two account types anyone can create; staff accounts are made by a Super Admin.
const SIGNUP_CHOICES = [
  {
    value: 'CUSTOMER',
    title: 'I need pickups',
    text: 'Book and pay for collection at my gate',
    icon: Home,
    on: 'border-customer bg-customer-wash ring-3 ring-customer/15',
    chip: 'bg-customer text-white',
  },
  {
    value: 'DRIVER',
    title: 'I want to drive',
    text: 'Collect at night and get paid to MoMo',
    icon: Truck,
    on: 'border-driver bg-driver-wash ring-3 ring-driver/20',
    chip: 'bg-driver text-night',
  },
]

export default function SignupPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // "Become a driver" links arrive with ?role=driver; the person can still change it.
  const roleFromLink = useClientValue(
    () => (new URLSearchParams(window.location.search).get('role') === 'driver' ? 'DRIVER' : 'CUSTOMER'),
    'CUSTOMER'
  )
  const [chosenRole, setRole] = useState<string | null>(null)
  const role = chosenRole ?? roleFromLink
  // The age the person confirmed, per role (the wording differs, so switching role asks again). Privacy policy section 9.
  const [ageConfirmedFor, setAgeConfirmedFor] = useState<string | null>(null)
  const ageConfirmed = ageConfirmedFor === role
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  // Came from pricing a pickup (lib/booking-draft.ts): say it's kept.
  const pricedFirst = useClientValue(() => draftRaw() !== '', false)
  const router = useRouter()
  const strengthChecks = checkStrength(password)
  const allPass = strengthChecks.every((c) => c.pass)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!allPass) {
      setError('Please meet all the password rules below before continuing')
      return
    }
    if (!ageConfirmed) {
      setError(role === 'DRIVER' ? 'Please confirm you are 18 or older' : 'Please confirm your age')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, password, role, ageConfirmed }),
      })
      const data = await res.json().catch(() => ({}))
      setLoading(false)

      if (!res.ok) {
        setError(data.error || 'We could not create your account. Please try again.')
        return
      }

      if (data.confirmEmail) {
        setCheckEmail(true)
        return
      }
      // Signed in already (no email to confirm): straight in. A pickup priced before signing up opens next.
      router.push('/dashboard')
      router.refresh()
    } catch {
      setLoading(false)
      setError('Could not reach Trashit. Please check your connection and try again.')
    }
  }

  if (checkEmail) {
    return (
      <AuthShell agreeVerb="creating an account">
        <span className="grid size-12 place-items-center rounded-card bg-customer-wash text-customer-deep">
          <MailCheck aria-hidden className="size-6" />
        </span>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Check your email</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          We sent a link to <strong className="font-semibold text-ink">{email}</strong>. Tap it to confirm your address,
          then sign in to start using Trashit.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-ink-3">
          Nothing after a few minutes? Check your spam folder, or go to sign in and ask for the email again.
        </p>
        <Link href="/login" className={`mt-8 ${AUTH_BUTTON}`}>
          Go to sign in <ArrowRight aria-hidden className="size-4" />
        </Link>
      </AuthShell>
    )
  }

  const field = AUTH_FIELD
  const label = 'text-sm font-medium text-ink-2'

  return (
    <AuthShell agreeVerb="creating an account">
      <AuthTabs current="signup" />
      <h1 className="mt-7 text-2xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-2 text-[15px] text-ink-2">
        {pricedFirst ? 'Your pickup is saved. Create your account to book it; it takes about a minute.' : 'It takes about a minute.'}
      </p>

      <form onSubmit={handleSignup} className="mt-6 grid gap-4">
        <fieldset>
          <legend className={label}>What do you want to do?</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2.5">
            {SIGNUP_CHOICES.map(({ value, title, text, icon: Icon, on, chip }) => {
              const selected = role === value
              return (
                <label
                  key={value}
                  className={`relative flex cursor-pointer flex-col gap-2 rounded-card border p-3.5 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ops ${
                    selected ? on : 'border-line-strong bg-surface hover:border-ink-3'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={value}
                    checked={selected}
                    onChange={() => setRole(value)}
                    className="sr-only"
                  />
                  <span className={`grid size-9 place-items-center rounded-[10px] ${chip}`}>
                    <Icon aria-hidden className="size-[18px]" />
                  </span>
                  <span className="text-[15px] font-semibold leading-tight text-ink">{title}</span>
                  <span className="text-xs leading-snug text-ink-3">{text}</span>
                  {selected && (
                    <Check aria-hidden className="absolute right-3 top-3 size-4 text-ink" strokeWidth={2.5} />
                  )}
                </label>
              )
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="name" className={label}>
            Full name
          </label>
          <input
            id="name"
            placeholder="e.g. Akosua Mensah"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            className={`${field} mt-1.5`}
          />
        </div>
        <div>
          <label htmlFor="phone" className={label}>
            Phone number
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            placeholder="024 412 3456"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            autoComplete="tel"
            aria-describedby="phone-hint"
            className={`${field} mt-1.5`}
          />
          <p id="phone-hint" className="mt-1.5 text-xs text-ink-3">
            {role === 'DRIVER' ? 'Dispatch and customers can reach you on this number.' : 'Your driver can call you on this number if needed.'}
          </p>
        </div>
        <div>
          <label htmlFor="email" className={label}>
            Email
          </label>
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className={`${field} mt-1.5`}
          />
        </div>
        <div>
          <label htmlFor="password" className={label}>
            Password
          </label>
          <div className="mt-1.5">
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className={field}
            />
          </div>
          <ul className="-mt-1 grid gap-1 text-xs" aria-label="Password rules">
            {strengthChecks.map((c) => (
              <li key={c.label} className={`flex items-center gap-1.5 ${c.pass ? 'text-customer-deep' : 'text-ink-3'}`}>
                {c.pass ? <Check aria-hidden className="size-3.5" strokeWidth={2.5} /> : <Circle aria-hidden className="size-3" />}
                {c.label}
                <span className="sr-only">{c.pass ? '(done)' : '(not yet)'}</span>
              </li>
            ))}
          </ul>
        </div>

        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px] leading-snug text-ink">
          <input
            type="checkbox"
            checked={ageConfirmed}
            onChange={(e) => setAgeConfirmedFor(e.target.checked ? role : null)}
            required
            className="mt-0.5 size-5 shrink-0 accent-[var(--color-ops)]"
          />
          <span>
            {role === 'DRIVER'
              ? 'I am 18 or older.'
              : 'I am 18 or older, or I am 16 or 17 and my parent or guardian has agreed to me using Trashit.'}
          </span>
        </label>

        <ErrorLine text={error} />
        <button type="submit" disabled={loading} className={AUTH_BUTTON}>
          {loading ? 'Creating your account…' : 'Create account'} {!loading && <ArrowRight aria-hidden className="size-4" />}
        </button>
      </form>
      <p className="mt-6 text-sm text-ink-2">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-ops-deep hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
