import crypto from 'crypto'

export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' }
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must include at least one uppercase letter' }
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must include at least one lowercase letter' }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must include at least one number' }
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, message: 'Password must include at least one symbol (e.g. ! @ # $)' }
  }
  return { valid: true }
}

// Checks the password against known data breaches using the "Have I Been Pwned"
// k-anonymity API. Only the first 5 characters of the password's SHA-1 hash are
// ever sent to the API — the full password never leaves your server.
export async function isPasswordBreached(password: string): Promise<boolean> {
  const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase()
  const prefix = sha1.slice(0, 5)
  const suffix = sha1.slice(5)

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`)
    if (!res.ok) return false // fail open — don't block signup if the check service is down
    const text = await res.text()
    return text.split('\n').some((line) => line.startsWith(suffix))
  } catch (e) {
    console.error('Breach check failed:', e)
    return false // fail open
  }
}