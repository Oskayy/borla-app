import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { validatePasswordStrength, isPasswordBreached } from '@/lib/password'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  const strength = validatePasswordStrength(password)
  if (!strength.valid) {
    return NextResponse.json({ error: strength.message }, { status: 400 })
  }

  if (await isPasswordBreached(password)) {
    return NextResponse.json(
      { error: 'This password has appeared in a known data breach. Please choose a different password.' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Your reset link has expired. Please request a new one.' }, { status: 401 })
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}