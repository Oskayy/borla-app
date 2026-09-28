// Accepts a number or numeric string; returns it only if it is within min..max, otherwise null.
export function inRange(value: unknown, min: number, max: number): number | null {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : NaN
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}