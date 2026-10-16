'use client'

import { useReportWebVitals } from 'next/web-vitals'

// Sends each page's speed measurements (Core Web Vitals) to /api/vitals, anonymously: the metric, its value, the kind
// of screen and the page's path, nothing else (lib/vitals.ts). Uses sendBeacon so it never slows the page or blocks
// leaving it. Defined outside the component so the hook gets the same function every render (no duplicate reports).
function report(metric: { name: string; value: number; rating: string }) {
  if (!['LCP', 'INP', 'CLS', 'FCP', 'TTFB'].includes(metric.name)) return
  const w = window.innerWidth
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    path: window.location.pathname,
    device: w < 768 ? 'phone' : w < 1024 ? 'tablet' : 'computer',
  })
  try {
    if (navigator.sendBeacon?.('/api/vitals', new Blob([body], { type: 'application/json' }))) return
    fetch('/api/vitals', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {})
  } catch {}
}

export default function WebVitals() {
  useReportWebVitals(report)
  return null
}
