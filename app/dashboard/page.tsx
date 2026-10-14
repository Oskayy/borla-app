import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Look up this user's role in our own database
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
  })

  // Signed in with Google (or another provider) for the first time: finish the account first.
  if (!dbUser) {
    redirect('/signup/finish')
  }
  if (!dbUser.active) {
    redirect('/login')
  }

  // Staff created with a temporary password choose their own first.
  if (dbUser.mustChangePassword) {
    redirect('/reset-password?first=1')
  }

  if (dbUser.role === 'CUSTOMER') {
    redirect('/dashboard/customer')
  }

    if (dbUser.role === 'DRIVER') {
    const driverProfile = await prisma.driverProfile.findUnique({ where: { userId: dbUser.id } })

    if (!driverProfile || !driverProfile.vehicleTypeId || driverProfile.homeLat == null) {
      redirect('/dashboard/driver/profile-setup')
    }
    if (driverProfile.approvalStatus !== 'APPROVED') {
      redirect('/dashboard/driver/verification')
    }

    redirect('/dashboard/driver')
  }

  const opsRoles = ['SUPER_ADMIN', 'OPS_MANAGER', 'DISPATCHER', 'FINANCE', 'SUPPORT', 'COMPLIANCE', 'ANALYST']
  if (opsRoles.includes(dbUser.role)) {
    const { data: factorsData } = await supabase.auth.mfa.listFactors()
    const hasVerifiedFactor = factorsData?.totp?.some((f) => f.status === 'verified')

    if (!hasVerifiedFactor) {
      redirect('/security/setup')
    }

    redirect('/ops')
  }

  // Fallback for any other/unrecognized role
  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 20 }}>
      <h1>Welcome, {dbUser.name}</h1>
      <p>Role: {dbUser.role}</p>
      <p style={{ color: 'var(--color-ink-3)', fontSize: 13 }}>This role doesn&apos;t have a dashboard yet.</p>
    </div>
  )
}