import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { friendlyAuthError } from '@/lib/friendly-errors'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
  if (error) {
    return NextResponse.json({ error: friendlyAuthError(error, "We couldn't start two-factor set-up. Please try again.") }, { status: 400 })
  }

  return NextResponse.json({
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  })
}