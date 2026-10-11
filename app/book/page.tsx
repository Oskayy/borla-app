import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { getAcceptHazardous } from '@/lib/settings'
import BookingForm from '@/components/BookingForm'
import Logo from '@/components/Logo'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Price a pickup · Trashit' }

// Try Trashit before making an account: choose bins, drop a pin, see the price and collection night.
// Booking itself needs an account; what they chose is kept on the phone for after they sign up.
export default async function TryBookingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard/customer/book')

  const [sizes, acceptHazardous] = await Promise.all([
    prisma.binSize.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { code: true, label: true, litres: true } }),
    getAcceptHazardous(),
  ])

  return (
    <div data-surface="new" className="min-h-dvh bg-canvas text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Trashit home">
            <Logo height={26} />
          </Link>
          <Link href="/login" className="ml-auto rounded-control px-3 py-2.5 text-sm font-medium text-ink-2 hover:text-ink">
            Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <BookingForm sizes={sizes} home={null} acceptHazardous={acceptHazardous} guest />
      </main>
    </div>
  )
}
