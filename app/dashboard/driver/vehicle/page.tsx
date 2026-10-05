import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { driverPhotoUrls } from '@/lib/driver-photos'
import { BUTTON_QUIET, Card } from '@/components/ui'
import { BackToAccount } from '@/components/driver/AccountRow'
import PhotoUpload from '@/components/driver/PhotoUpload'
import InfoTip from '@/components/InfoTip'
import { Chip } from '@/components/ops/kit'

export const dynamic = 'force-dynamic'

// The driver's vehicle: what it is, its size and reach, and its photo. Changing the type goes through approval.
export default async function DriverVehiclePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profile, photos] = await Promise.all([
    prisma.driverProfile.findUnique({
      where: { userId: user.id },
      select: {
        vehiclePlate: true,
        radiusKm: true,
        pendingVehicleTypeId: true,
        vehicleTypeRef: { select: { name: true, capacityLitres: true, maxRadiusKm: true } },
      },
    }),
    driverPhotoUrls(user.id, ['vehicle_photo']),
  ])
  if (!profile) redirect('/dashboard/driver/profile-setup')
  const v = profile.vehicleTypeRef

  return (
    <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-5">
      <div>
        <BackToAccount />
        <h1 className="text-[clamp(1.5rem,3vw,1.9rem)] font-bold tracking-[-0.025em]">Vehicle</h1>
      </div>

      <Card>
        <PhotoUpload type="vehicle_photo" url={photos.vehicle_photo} label="Change the photo of your vehicle" />
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex flex-wrap items-center gap-2 text-lg font-bold tracking-tight">
              {v?.name ?? 'No vehicle yet'}
              {profile.pendingVehicleTypeId && <Chip tone="driver">Change waiting for approval</Chip>}
            </p>
            <p className="text-sm text-ink-3">{profile.vehiclePlate ? `Plate ${profile.vehiclePlate}` : 'No plate number'}</p>
          </div>
          <Link href="/dashboard/driver/profile-setup" className={BUTTON_QUIET}>
            <Pencil aria-hidden className="size-4" /> Change
          </Link>
        </div>
        {v && (
          <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4">
            <div>
              <dt className="flex items-center gap-1.5 text-sm text-ink-3">
                Load size <InfoTip text="How much fits before you unload at a disposal site. Trips are planned to about 90% of this." />
              </dt>
              <dd className="mt-0.5 text-xl font-bold tabular-nums">{v.capacityLitres.toLocaleString()} L</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-3">Your radius</dt>
              <dd className="mt-0.5 text-xl font-bold tabular-nums">
                {profile.radiusKm ?? '–'} km <span className="text-sm font-normal text-ink-3">of {v.maxRadiusKm} km max</span>
              </dd>
            </div>
          </dl>
        )}
      </Card>
    </div>
  )
}
