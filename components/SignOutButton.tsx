'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

// Signs out of Trashit on this device only, then opens the home page.
export default function SignOutButton({
  className,
  label = 'Sign out of this device',
  iconClassName = 'size-4',
  labelClassName,
}: {
  className: string
  label?: string
  iconClassName?: string
  labelClassName?: string // e.g. the rail's label that shows only while it is open
}) {
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function signOut() {
    setBusy(true)
    await createClient().auth.signOut({ scope: 'local' }).catch(() => {})
    router.replace('/')
    router.refresh() // nothing from the signed-in app stays cached
  }

  return (
    <button type="button" onClick={signOut} disabled={busy} aria-label={labelClassName ? label : undefined} className={className}>
      <LogOut aria-hidden className={`shrink-0 ${iconClassName}`} />
      <span aria-hidden={labelClassName ? true : undefined} className={labelClassName}>
        {busy ? 'Signing out…' : label}
      </span>
    </button>
  )
}
