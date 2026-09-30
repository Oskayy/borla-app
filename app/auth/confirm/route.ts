import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')

  // Only allow redirects to paths inside this site.
  const rawNext = searchParams.get('next') ?? '/'
  const next =
    rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes('\\') && !rawNext.includes('@')
      ? rawNext
      : '/'

  const isReset = next.startsWith('/reset-password')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    // Email confirmation: Supabase has already confirmed the address before sending the person here.
    // The sign-in part can fail if the link was opened on another phone or browser, which is fine:
    // they just log in.
    if (!isReset) {
      return NextResponse.redirect(`${origin}/login?confirmed=1`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=${isReset ? 'reset-link-invalid' : 'confirm-link-invalid'}`)
}