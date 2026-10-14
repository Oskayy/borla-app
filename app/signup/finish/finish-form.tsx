'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Home, Truck } from 'lucide-react'
import AuthShell, { AUTH_BUTTON, AUTH_FIELD, ErrorLine } from '@/components/auth/AuthShell'
import { ErrorSummary, FieldError, fieldA11y, type FieldProblem } from '@/components/FormErrors'

const ROLE_CARDS = [
  { value: 'CUSTOMER', title: 'I need pickups', text: 'Book and pay for collection at my gate', icon: Home },
  { value: 'DRIVER', title: 'I want to drive', text: 'Collect at night and get paid to MoMo', icon: Truck },
] as const

export default function FinishSignupForm({ email, defaultName, defaultRole }: { email: string; defaultName: string; defaultRole: 'CUSTOMER' | 'DRIVER' }) {
  const [role, setRole] = useState<string>(defaultRole)
  const [name, setName] = useState(defaultName)
  const [phone, setPhone] = useState('')
  // The age the person confirmed, per role (the wording differs, so switching role asks again).
  const [ageFor, setAgeFor] = useState<string | null>(null)
  const ageConfirmed = ageFor === role
  const [problems, setProblems] = useState<FieldProblem[]>([])
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const problem = (id: string) => problems.find((p) => p.field === id)?.text

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const found: FieldProblem[] = []
    if (!name.trim()) found.push({ field: 'name', text: 'Enter your full name' })
    if (!/^\+?[0-9 ()-]{9,20}$/.test(phone.trim())) found.push({ field: 'phone', text: 'Enter a phone number like 024 412 3456' })
    if (!ageConfirmed) found.push({ field: 'age', text: role === 'DRIVER' ? 'Confirm you are 18 or older to drive' : 'Confirm your age to continue' })
    setProblems(found)
    setAttempt((a) => a + 1)
    if (found.length) return

    setLoading(true)
    try {
      const res = await fetch('/api/auth/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), role, ageConfirmed: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLoading(false)
        setError(data.error || 'We could not finish your account. Please try again.')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setLoading(false)
      setError('Something went wrong. Please try again.')
    }
  }

  const label = 'text-sm font-medium text-ink-2'
  return (
    <AuthShell agreeVerb="creating an account">
      <h1 className="text-2xl font-bold tracking-tight">Almost done</h1>
      <p className="mt-2 text-[15px] text-ink-2">
        You&apos;re signed in as <span className="font-semibold text-ink">{email}</span>. Tell us a little more to finish your account.
      </p>
      <form onSubmit={submit} noValidate className="mt-6 grid gap-4">
        <ErrorSummary problems={problems} attempt={attempt} />
        <fieldset>
          <legend className={label}>What do you want to do?</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2.5">
            {ROLE_CARDS.map(({ value, title, text, icon: Icon }) => {
              const on = role === value
              return (
                <label
                  key={value}
                  className={`lift relative flex cursor-pointer flex-col gap-2 rounded-card p-3.5 ring-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
                    on ? 'bg-action-wash ring-2 ring-action-deep' : 'bg-surface ring-line-strong'
                  }`}
                >
                  <input type="radio" name="role" value={value} checked={on} onChange={() => setRole(value)} className="sr-only" />
                  <span className={`grid size-9 place-items-center rounded-[12px] ${on ? 'bg-hero text-on-hero' : 'bg-canvas text-ink-2'}`}>
                    <Icon aria-hidden className="size-[18px]" />
                  </span>
                  <span className="text-[15px] font-semibold leading-tight">{title}</span>
                  <span className="text-xs leading-snug text-ink-3">{text}</span>
                  {on && <Check aria-hidden className="absolute right-3 top-3 size-4" strokeWidth={2.5} />}
                </label>
              )
            })}
          </div>
        </fieldset>
        <div>
          <label htmlFor="name" className={label}>
            Full name
          </label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" {...fieldA11y('name', problem('name'))} className={`${AUTH_FIELD} mt-1.5`} />
          <FieldError id="name" text={problem('name')} />
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
            autoComplete="tel"
            {...fieldA11y('phone', problem('phone'), 'phone-hint')}
            className={`${AUTH_FIELD} mt-1.5`}
          />
          <FieldError id="phone" text={problem('phone')} />
          <p id="phone-hint" className="mt-1.5 text-xs text-ink-3">
            {role === 'DRIVER' ? 'Dispatch and customers can reach you on this number.' : 'Your driver can call you on this number if needed.'}
          </p>
        </div>
        <div>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px] leading-snug text-ink">
            <input
              id="age"
              type="checkbox"
              {...fieldA11y('age', problem('age'))}
              checked={ageConfirmed}
              onChange={(e) => setAgeFor(e.target.checked ? role : null)}
              className="mt-0.5 size-5 shrink-0 accent-[var(--color-action-deep)]"
            />
            <span>
              {role === 'DRIVER' ? 'I am 18 or older.' : 'I am 18 or older, or I am 16 or 17 and my parent or guardian has agreed to me using Trashit.'}
            </span>
          </label>
          <FieldError id="age" text={problem('age')} />
        </div>
        <ErrorLine text={error} />
        <button type="submit" disabled={loading} className={AUTH_BUTTON}>
          {loading ? 'Finishing…' : 'Finish my account'} {!loading && <ArrowRight aria-hidden className="size-4" />}
        </button>
      </form>
    </AuthShell>
  )
}
