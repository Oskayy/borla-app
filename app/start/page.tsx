import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

// Where the installed app opens. Signed-in people go to their dashboard; everyone else sees Trashit first
// (and can price a pickup) instead of a sign-in form. The launch screen shows while this decides.
export default async function Start() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  redirect(user ? '/dashboard' : '/')
}
