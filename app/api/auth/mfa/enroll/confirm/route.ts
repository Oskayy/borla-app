import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  const { factorId, code } = await req.json()

  if (!factorId || !code) {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
  if (challengeError || !challenge) {
    return NextResponse.json({ error: 'Could not verify. Please try again.' }, { status: 400 })
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  })

  if (verifyError) {
    return NextResponse.json({ error: 'Incorrect code. Double check your authenticator app and try again.' }, { status: 401 })
  }

  return NextResponse.json({ success: true })
}