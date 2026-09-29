// Opens turn-by-turn directions in the driver's own navigation app.
// Plain links, so they work on any phone and nothing is sent to Borla.
export default function NavigateButtons({ lat, lng }: { lat: number; lng: number }) {
  const google = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
  const waze = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
  const style = {
    display: 'inline-block',
    fontSize: 13,
    padding: '6px 12px',
    borderRadius: 4,
    textDecoration: 'none',
    border: '1px solid var(--color-primary)',
    color: 'var(--color-primary)',
    background: 'white',
  } as const

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
      <a href={google} target="_blank" rel="noopener noreferrer" style={{ ...style, background: 'var(--color-primary)', color: 'white' }}>
        Navigate (Google Maps)
      </a>
      <a href={waze} target="_blank" rel="noopener noreferrer" style={style}>
        Waze
      </a>
    </div>
  )
}
