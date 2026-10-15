'use client'

import { useEffect } from 'react'

// Small pointer effects for the whole site and apps, wired once on the document:
// - a soft ripple where a `.press` control is tapped;
// - `[data-tilt]` cards lean a little toward the mouse (with a sheen that follows it, `.sheen`);
// - `[data-magnet]` buttons lean toward the mouse;
// - `[data-spot]` areas get --sx/--sy (the mouse position) for a spotlight.
// Nothing runs with reduced motion, and the mouse effects skip touch screens.
export default function PointerFx() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const onDown = (e: PointerEvent) => {
      const b = (e.target as Element | null)?.closest?.('.press') as HTMLElement | null
      if (!b || b.matches(':disabled')) return
      const r = b.getBoundingClientRect()
      const size = Math.max(r.width, r.height) * 2.2
      const wrap = document.createElement('span')
      wrap.className = 'fx-rip'
      const dot = document.createElement('i')
      dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`
      wrap.appendChild(dot)
      b.appendChild(wrap)
      window.setTimeout(() => wrap.remove(), 560)
    }
    document.addEventListener('pointerdown', onDown, { passive: true })

    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (!fine) return () => document.removeEventListener('pointerdown', onDown)

    let tilted: HTMLElement | null = null
    let pulled: HTMLElement | null = null
    let frame = 0
    let last: PointerEvent | null = null
    const apply = () => {
      frame = 0
      const e = last
      if (!e) return
      const el = e.target as Element | null
      const t = el?.closest?.('[data-tilt]') as HTMLElement | null
      if (tilted && tilted !== t) {
        tilted.style.removeProperty('--rx')
        tilted.style.removeProperty('--ry')
      }
      if (t) {
        const r = t.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width - 0.5
        const y = (e.clientY - r.top) / r.height - 0.5
        t.style.setProperty('--rx', `${(-y * 5).toFixed(2)}deg`)
        t.style.setProperty('--ry', `${(x * 7).toFixed(2)}deg`)
        t.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`)
        t.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`)
      }
      tilted = t
      const m = el?.closest?.('[data-magnet]') as HTMLElement | null
      if (pulled && pulled !== m) {
        pulled.style.removeProperty('--mx')
        pulled.style.removeProperty('--my')
      }
      if (m) {
        const r = m.getBoundingClientRect()
        m.style.setProperty('--mx', `${((e.clientX - r.left - r.width / 2) * 0.16).toFixed(1)}px`)
        m.style.setProperty('--my', `${((e.clientY - r.top - r.height / 2) * 0.24).toFixed(1)}px`)
      }
      pulled = m
      const s = el?.closest?.('[data-spot]') as HTMLElement | null
      if (s) {
        const r = s.getBoundingClientRect()
        s.style.setProperty('--sx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`)
        s.style.setProperty('--sy', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`)
      }
    }
    const onMove = (e: PointerEvent) => {
      last = e
      if (!frame) frame = requestAnimationFrame(apply)
    }
    document.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointermove', onMove)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
  return null
}
