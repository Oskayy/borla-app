import Logo from '@/components/Logo'

// What people see while the app opens or a page loads with no skeleton of its own. Something always moves
// (the mark lifts and settles, the bar sweeps), so it never looks frozen. Pure CSS: shows before any script runs.
export default function LaunchScreen({ label = 'Opening Trashit' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="flex flex-col items-center">
        <span className="launch-mark">
          <Logo variant="mark" height={72} />
        </span>
        <span className="mt-5">
          <Logo height={26} />
        </span>
        <span aria-hidden className="mt-7 block h-1 w-36 overflow-hidden rounded-full bg-line">
          <span className="launch-bar block h-full w-1/3 rounded-full bg-customer" />
        </span>
        <span className="sr-only">{label}…</span>
      </div>
    </div>
  )
}
