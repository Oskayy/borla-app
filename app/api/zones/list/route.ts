import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const zones = await prisma.zone.findMany({
    where: { active: true },
    select: { id: true, name: true, city: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ zones })
}