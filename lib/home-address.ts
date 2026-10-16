// A customer's home is two parts: the place (area or street, found from the pin or typed) and a landmark drivers can
// spot at night. They are kept apart on the profile and shown together wherever the pickup address appears.

export const LANDMARK_MAX = 120

export function homeLabel(place: string, landmark: string | null | undefined): string {
  const l = landmark?.trim()
  return l ? `${place} · ${l}` : place
}
