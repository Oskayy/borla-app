import { CloudRain, CloudSun, Fuel } from 'lucide-react'
import { nearbyFuel, nightWeather, weatherLine } from '@/lib/driver-tips'
import { googleDirectionsUrl } from '@/lib/navigation'
import type { ShiftSettings } from '@/lib/shift'

const CARD = 'block h-full rounded-card bg-surface p-4 shadow-card ring-1 ring-line/70'

function Body({ icon: Icon, title, text }: { icon: typeof Fuel; title: string; text: string }) {
  return (
    <>
      <span className="grid size-10 place-items-center rounded-[14px] bg-action-wash text-action-deep">
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="mt-3 block text-[15px] font-semibold">{title}</span>
      <span className="mt-0.5 block text-sm text-ink-2">{text}</span>
    </>
  )
}

// Tonight's weather and the nearest fuel, from outside services. Streamed in after the page shows (inside
// <Suspense>), so a slow service never holds the driver up; if one fails, its card is simply left out.
export default async function OutsideTips({ area, shiftDate, settings }: { area: { lat: number; lng: number }; shiftDate: string; settings: ShiftSettings }) {
  const [weather, fuel] = await Promise.all([nightWeather(area, shiftDate, settings), nearbyFuel(area)])
  return (
    <>
      {weather && (
        <li className="anim-rise">
          <div className={CARD}>
            <Body icon={weather.rainFrom ? CloudRain : CloudSun} title="Tonight's weather" text={weatherLine(weather)} />
          </div>
        </li>
      )}
      {fuel[0] && (
        <li className="anim-rise">
          <a href={googleDirectionsUrl({ lat: fuel[0].lat, lng: fuel[0].lng }, null)} target="_blank" rel="noopener noreferrer" className={`lift ${CARD}`}>
            <Body
              icon={Fuel}
              title="Nearest fuel"
              text={`${fuel
                .slice(0, 2)
                .map((f) => `${f.name} (${f.km < 1 ? `${Math.round(f.km * 1000)} m` : `${f.km.toFixed(1)} km`})`)
                .join(', ')}. Tap for directions.`}
            />
          </a>
        </li>
      )}
    </>
  )
}

export function OutsideTipsLoading() {
  return (
    <>
      {[0, 1].map((i) => (
        <li key={i} aria-hidden className="h-[132px] rounded-card bg-surface p-4 shadow-card ring-1 ring-line/70">
          <span className="skeleton block size-10 rounded-[14px]" />
          <span className="skeleton mt-3 block h-4 w-1/2" />
          <span className="skeleton mt-2 block h-3 w-3/4" />
        </li>
      ))}
    </>
  )
}
