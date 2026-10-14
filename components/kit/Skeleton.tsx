// A loading placeholder in the shape of what is coming; a soft light sweeps across it (still with reduced motion).
// Size and shape come from className, e.g. "h-6 w-40" or "h-16 rounded-full".
export default function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`skeleton block ${className}`} />
}
