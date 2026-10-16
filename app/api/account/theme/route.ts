import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { readJson } from '@/lib/validate'
import { parseThemePrefs, THEME_APPS, type ThemeApp } from '@/lib/theme'

// Saves the signed-in person's light or dark choice for one app (lib/theme.ts), so it follows them to other devices.
export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) return auth.response

  const body = await readJson(req)
  const app = body?.app as ThemeApp
  const theme = body?.theme
  if (!THEME_APPS.includes(app) || (theme !== 'light' && theme !== 'dark')) {
    return NextResponse.json({ error: 'Unknown theme' }, { status: 400 })
  }
  const me = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { themePrefs: true } })
  const prefs = { ...parseThemePrefs(me?.themePrefs), [app]: theme }
  await prisma.user.update({ where: { id: auth.user.id }, data: { themePrefs: prefs } })
  return NextResponse.json({ success: true })
}
