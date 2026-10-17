'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Menu, X } from 'lucide-react'
import Logo from '@/components/Logo'

const LINKS = [
  { href: '/#how', label: 'How it works' },
  { href: '/#coverage', label: 'Where we collect' },
  { href: '/#drivers', label: 'Drive with us' },
  { href: '/#faq', label: 'Questions' },
]

// The website's top bar: logo, sections, Sign in and the one main button. On phones the sections fold into a menu.
// `overHero` (the landing page): see-through with white text while it sits over the hero photo, the normal bar once
// the page is scrolled past it or the menu is open.
export default function SiteHeader({ overHero = false }: { overHero?: boolean }) {
  const [open, setOpen] = useState(false)
  const [overPhoto, setOverPhoto] = useState(overHero)
  useEffect(() => {
    if (!overHero) return
    const check = () => setOverPhoto(window.scrollY < window.innerHeight * 0.5)
    check()
    window.addEventListener('scroll', check, { passive: true })
    return () => window.removeEventListener('scroll', check)
  }, [overHero])
  const clear = overHero && overPhoto && !open
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-colors duration-300 ${
        clear ? 'border-transparent bg-transparent text-white' : 'border-line/60 bg-canvas/80 backdrop-blur-xl'
      }`}
    >
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:h-[72px] sm:px-6">
        <Link href="/" aria-label="Trashit home" className="shrink-0">
          {clear ? (
            <Logo height={30} onDark />
          ) : (
            <>
              <span className="only-light">
                <Logo height={30} />
              </span>
              <span className="only-dark">
                <Logo height={30} onDark />
              </span>
            </>
          )}
        </Link>
        <ul className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className={`rounded-full px-3 py-2 text-[15px] font-medium transition ${clear ? 'text-white/85 hover:bg-white/10 hover:text-white' : 'text-ink-2 hover:bg-surface hover:text-ink'}`}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-1.5">
          <Link href="/login" className={`hidden rounded-full px-3 py-2 text-[15px] font-semibold sm:inline-flex ${clear ? 'text-white hover:text-white/80' : 'text-ink-2 hover:text-ink'}`}>
            Sign in
          </Link>
          <Link
            href="/book"
            data-magnet
            className="press group hidden min-h-11 items-center gap-1.5 rounded-full bg-action px-5 text-[15px] font-semibold text-on-action shadow-card hover:shadow-lift sm:inline-flex"
          >
            Book a pickup <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className={`press grid size-11 place-items-center rounded-full ring-1 lg:hidden ${clear ? 'bg-white/10 text-white ring-white/35 backdrop-blur-sm' : 'bg-surface ring-line'}`}
          >
            {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          </button>
        </div>
      </nav>
      {open && (
        <div id="site-menu" className="anim-rise absolute inset-x-3 top-[calc(100%+8px)] rounded-[24px] bg-surface p-2.5 shadow-lift ring-1 ring-line lg:hidden">
          <ul className="grid">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-[16px] px-4 text-[17px] font-semibold hover:bg-canvas">
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <Link href="/login" onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-[16px] px-4 text-[17px] font-semibold hover:bg-canvas">
                Sign in
              </Link>
            </li>
          </ul>
          <Link href="/book" onClick={() => setOpen(false)} className="press mt-2 flex min-h-12 items-center justify-center gap-2 rounded-full bg-action font-semibold text-on-action">
            Book a pickup <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      )}
    </header>
  )
}
