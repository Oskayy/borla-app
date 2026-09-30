import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Reachable without a fully verified session.
const OPEN_PATHS = [
  '/', '/login', '/signup', '/forgot-password', '/reset-password',
  '/privacy-policy', '/terms', '/cookie-policy', '/refund-policy',
  '/manifest.webmanifest', '/sw.js',
]
const OPEN_PREFIXES = ['/api/auth/', '/auth/', '/api/payments/webhook']

function isOpen(pathname: string) {
  return OPEN_PATHS.includes(pathname) || OPEN_PREFIXES.some((p) => pathname.startsWith(p))
}

function withCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((c) => to.cookies.set(c))
  return to
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  if (user && !isOpen(pathname)) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

    // Password done, 2FA code not yet entered.
    const halfSignedIn = aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2'
    // Every /ops page needs a fully 2FA-verified session.
    const opsWithoutMfa = pathname.startsWith('/ops') && aal?.currentLevel !== 'aal2'

    if (halfSignedIn || opsWithoutMfa) {
      if (pathname.startsWith('/api/')) {
        return withCookies(
          response,
          NextResponse.json({ error: 'Two-factor verification required' }, { status: 401 })
        )
      }
      const url = request.nextUrl.clone()
      url.pathname = halfSignedIn ? '/login' : '/dashboard'
      url.search = ''
      return withCookies(response, NextResponse.redirect(url))
    }
  }

  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=()')

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}