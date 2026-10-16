import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import BookingForm from '@/components/BookingForm'
import { getAcceptHazardous } from '@/lib/settings'

export const dynamic = 'force-dynamic'

export default async function BookPickupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [sizes, profile, acceptHazardous] = await Promise.all([
    prisma.binSize.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: { code: true, label: true, litres: true },
    }),
    prisma.customerProfile.findUnique({
      where: { userId: user.id },
      select: { address: true, homeLandmark: true, homeLat: true, homeLng: true, homePinConfirmedAt: true },
    }),
    getAcceptHazardous(),
  ])

  // Only offer "use my home" once the customer has pinned it on the map and confirmed the pin is on their gate.
  // Homes saved before that check existed are asked to look at their pin again.
  const pinned = !!profile && profile.homeLat != null && profile.homeLng != null
  const home = pinned && profile!.homePinConfirmedAt ? { address: profile!.address, landmark: profile!.homeLandmark } : null
  const homeNeedsCheck = pinned && !profile!.homePinConfirmedAt

  return <BookingForm sizes={sizes} home={home} homeNeedsCheck={homeNeedsCheck} acceptHazardous={acceptHazardous} />
}
