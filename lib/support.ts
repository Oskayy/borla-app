// How customers reach Trashit. Fill these in when support is set up; the "Need help?" panel stays hidden until
// at least one is set. WhatsApp: international format without "+" (e.g. "233241234567").
export const SUPPORT: { phone: string | null; whatsapp: string | null; email: string | null } = {
  phone: null,
  whatsapp: null,
  email: null,
}

export function supportHref(): string | null {
  if (SUPPORT.whatsapp) return `https://wa.me/${SUPPORT.whatsapp}`
  if (SUPPORT.phone) return `tel:${SUPPORT.phone.replace(/\s+/g, '')}`
  if (SUPPORT.email) return `mailto:${SUPPORT.email}`
  return null
}
