'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { isTabActive, type Tab } from '@/components/kit/TabBar'

export interface RailItem extends Tab {
  count?: number // things waiting there
  urgent?: boolean // waiting work is a problem now (red badge)
  countText?: string // what the count means, for screen readers (default "waiting")
}

// The label beside an icon: hidden while the rail is folded, shown while it is open (mouse on it, keyboard in it, or
// opened with its button on a touch screen, where there is no hover).
export const RAIL_LABEL =
  'truncate whitespace-nowrap text-[15px] font-semibold opacity-0 transition-opacity duration-200 group-hover/rail:opacity-100 group-has-[:focus-visible]/rail:opacity-100 group-data-[open]/rail:opacity-100'

// Classes the rail's container adds while it is open by its button.
export const RAIL_OPEN = 'data-[open]:shadow-lift'

// Open or closed by the button at the top (for touch screens). Closes when a link in it is tapped or after a tap
// outside it.
export function useRailToggle() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])
  return {
    ref,
    open,
    toggle: () => setOpen((o) => !o),
    // spread on the container: a tap on a link closes it
    props: {
      'data-open': open || undefined,
      onClick: (e: React.MouseEvent) => {
        if ((e.target as Element).closest('a')) setOpen(false)
      },
    },
  }
}

// The "show names" button at the top of a rail.
export function RailToggle({ open, onToggle, className = '' }: { open: boolean; onToggle: () => void; className?: string }) {
  const Icon = open ? PanelLeftClose : PanelLeftOpen
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? 'Hide page names' : 'Show page names'}
      className={`press flex h-11 w-full shrink-0 items-center gap-3 rounded-[16px] px-3 text-ink-3 hover:bg-surface hover:text-ink ${className}`}
    >
      <Icon aria-hidden className="size-[22px] shrink-0" />
      <span aria-hidden className={`${RAIL_LABEL} text-sm font-medium`}>
        {open ? 'Hide names' : 'Show names'}
      </span>
    </button>
  )
}

// Desktop: a narrow rail of icons that widens over the page when the mouse is on it (or when someone tabs into it
// with the keyboard), showing each name beside its icon, and folds back to icons when the mouse leaves. On a touch
// screen the button at the top opens and closes it. Counts show as small badges.
export default function IconRail({ items, label, top, bottom }: { items: RailItem[]; label: string; top?: React.ReactNode; bottom?: React.ReactNode }) {
  const pathname = usePathname()
  const { ref: railRef, open: railOpen, toggle: toggleRail, props: railProps } = useRailToggle()
  return (
    <div
      ref={railRef}
      {...railProps}
      className={`group/rail absolute inset-y-0 left-0 z-40 flex w-[84px] flex-col gap-3 overflow-hidden border-r border-line bg-rail px-[18px] py-5 transition-[width,box-shadow] duration-300 ease-[var(--ease-out)] hover:w-[244px] hover:shadow-lift has-[:focus-visible]:w-[244px] has-[:focus-visible]:shadow-lift data-[open]:w-[244px] ${RAIL_OPEN}`}
    >
      {top}
      <RailToggle open={railOpen} onToggle={toggleRail} className="hidden [@media(pointer:coarse)]:flex" />
      <nav aria-label={label} className="flex-1">
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => {
            const on = isTabActive(pathname, item)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={on ? 'page' : undefined}
                  aria-label={item.count ? `${item.label} (${item.count} ${item.countText ?? 'waiting'})` : item.label}
                  className={`press relative flex h-12 w-full items-center gap-3 rounded-[16px] px-3 transition-colors duration-200 ${
                    on ? 'bg-selected text-on-selected shadow-card' : 'text-ink-2 hover:bg-surface hover:text-ink'
                  }`}
                >
                  <Icon aria-hidden className="size-[22px] shrink-0" strokeWidth={on ? 2.3 : 2} />
                  <span aria-hidden className={RAIL_LABEL}>
                    {item.label}
                  </span>
                  {!!item.count && (
                    <span
                      aria-hidden
                      className={`absolute left-[30px] top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold tabular-nums ring-2 ring-rail group-hover/rail:left-auto group-hover/rail:right-3 group-hover/rail:top-3.5 group-data-[open]/rail:left-auto group-data-[open]/rail:right-3 group-data-[open]/rail:top-3.5 ${
                        item.urgent ? 'bg-danger text-white' : 'bg-highlight text-on-highlight'
                      }`}
                    >
                      {item.count > 99 ? '99+' : item.count}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      {bottom}
    </div>
  )
}
