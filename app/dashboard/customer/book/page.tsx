import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import BookingForm from '@/components/BookingForm'

export const dynamic = 'force-dynamic'

export default async function BookPickupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [sizes, profile] = await Promise.all([
    prisma.binSize.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: { code: true, label: true, litres: true },
    }),
    prisma.customerProfile.findUnique({
      where: { userId: user.id },
      select: { address: true, homeLat: true, homeLng: true },
    }),
  ])

  // Only offer "use my home" once the customer has actually pinned it on the map.
  const home = profile && profile.homeLat != null && profile.homeLng != null ? { address: profile.address } : null

  return <BookingForm sizes={sizes} home={home} />
}