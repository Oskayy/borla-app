import type { MetadataRoute } from 'next'

// Lets phones install Borla to the home screen as an app. On iPhone this is also what allows push alerts.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Borla',
    short_name: 'Borla',
    description: 'Waste collection, done reliably.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F7F5F1',
    theme_color: '#0F3D3E',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
