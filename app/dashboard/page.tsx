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

  if (!dbUser) {
    redirect('/login')
  }

  if (dbUser.role === 'CUSTOMER') {
    redirect('/dashboard/customer')
  }

  if (dbUser.role === 'DRIVER') {
    redirect('/dashboard/driver')
  }

  // Fallback for admin roles later
  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 20 }}>
      <h1>Welcome, {dbUser.name}</h1>
      <p>Role: {dbUser.role}</p>
    </div>
  )
}