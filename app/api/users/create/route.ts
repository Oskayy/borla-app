import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const { authId, name, phone, email, role } = await req.json()

  try {
    const user = await prisma.user.create({
      data: {
        id: authId,
        name,
        phone,
        email,
        role,
      },
    })
    return NextResponse.json(user)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not create user' }, { status: 500 })
  }
}