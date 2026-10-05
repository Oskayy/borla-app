'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

// Signs out of Trashit on this device only.
export default function SignOutButton({ className }: { className: string }) {
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function signOut() {
    setBusy(true)
    await createClient().auth.signOut({ scope: 'local' }).catch(() => {})
    router.push('/login')
    router.refresh()
  }

  return (
    <button type="button" onClick={signOut} disabled={busy} className={className}>
      <LogOut aria-hidden className="size-4" /> {busy ? 'Signing out…' : 'Sign out of this device'}
    </button>
  )
}
