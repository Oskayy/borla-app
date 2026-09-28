import { prisma } from '@/lib/prisma'
import BookingForm from '@/components/BookingForm'

export const dynamic = 'force-dynamic'

export default async function BookPickupPage() {
  const sizes = await prisma.binSize.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    select: { code: true, label: true, litres: true },
  })

  return <BookingForm sizes={sizes} />
}
