import { createAdminClient } from '@/lib/supabase-admin'

export const EVIDENCE_BUCKET = 'pickup-evidence'

// Photo paths must look exactly like "<orderId>/<filename>".
export function isValidEvidencePath(path: unknown, orderId: string): path is string {
  return (
    typeof path === 'string' &&
    path.length <= 200 &&
    path.startsWith(`${orderId}/`) &&
    path.split('/').length === 2 &&
    !path.includes('..') &&
    /^[A-Za-z0-9/_\-.]+$/.test(path)
  )
}

// Checks the file was actually uploaded to storage.
export async function evidenceFileExists(path: string): Promise<boolean> {
  const [folder, name] = path.split('/')
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(EVIDENCE_BUCKET)
    .list(folder, { search: name, limit: 5 })
  if (error || !data) return false
  return data.some((file) => file.name === name)
}