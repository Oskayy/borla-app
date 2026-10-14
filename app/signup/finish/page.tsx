import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import FinishSignupForm from './finish-form'

export const dynamic = 'force-dynamic'

// After "Continue with Google" for someone new: the provider gave us their email (and usually their name);
// we still need what Trashit needs: customer or driver, a phone number and the age confirmation.
export default async function FinishSignupPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signup')
  if (await prisma.user.findUnique({ where: { id: user.id }, select: { id: true } })) redirect('/dashboard')

  const { role } = await searchParams
  const meta = user.user_metadata ?? {}
  const name = typeof meta.full_name === 'string' ? meta.full_name : typeof meta.name === 'string' ? meta.name : ''
  return <FinishSignupForm email={user.email ?? ''} defaultName={name.slice(0, 100)} defaultRole={role === 'DRIVER' ? 'DRIVER' : 'CUSTOMER'} />
}
