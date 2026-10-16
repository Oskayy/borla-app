// Driver actions that survive a dropped connection. A pickup or unload is a photo plus a confirmation; at night, at a
// gate or a dump site, the signal often drops between the two. When that happens the action is kept on the phone
// (IndexedDB, photo included) and sent by itself, oldest first, once there is signal again (components/driver/OutboxBar.tsx).
// The server records the time the photo was taken (lib/taken-at.ts) and treats a repeat of the same action as done,
// so a retry can never count twice. Browser-only: import it from client components.

import { createClient } from '@/utils/supabase/client'

export type OutboxKind = 'pickup' | 'unload' | 'trip-unload'

export type OutboxItem = {
  id: string
  kind: OutboxKind
  label: string // what the driver sees, e.g. "Pickup at House 12"
  url: string
  body: Record<string, unknown> // sent with photoPath and takenAt added
  photo: Blob
  photoPath: string
  takenAt: string
  tries: number
  error?: string // the server said no; shown to the driver until they remove it
}

export type SendResult =
  | { status: 'sent'; data: Record<string, unknown> }
  | { status: 'queued' }
  | { status: 'failed'; error: string }

const DB = 'trashit-outbox'
const STORE = 'items'
export const OUTBOX_EVENT = 'trashit-outbox'

class NetworkError extends Error {}

function looksOffline(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const text = String((err as { message?: string })?.message ?? err)
  return err instanceof TypeError || /fetch|network|load failed|timed? ?out|connection/i.test(text)
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = run(t.objectStore(STORE))
    t.oncomplete = () => {
      db.close()
      resolve(req ? req.result : undefined)
    }
    t.onerror = () => {
      db.close()
      reject(t.error)
    }
  })
}

function changed() {
  window.dispatchEvent(new Event(OUTBOX_EVENT))
}

export async function listOutbox(): Promise<OutboxItem[]> {
  try {
    const all = (await tx<OutboxItem[]>('readonly', (s) => s.getAll())) ?? []
    return all.sort((a, b) => a.takenAt.localeCompare(b.takenAt))
  } catch {
    return [] // private mode or storage blocked: nothing kept
  }
}

export async function removeFromOutbox(id: string) {
  await tx('readwrite', (s) => s.delete(id)).catch(() => {})
  changed()
}

async function save(item: OutboxItem) {
  await tx('readwrite', (s) => s.put(item))
  changed()
}

// Uploads the photo (an upload that already happened counts) and sends the confirmation.
async function deliver(item: Pick<OutboxItem, 'url' | 'body' | 'photo' | 'photoPath' | 'takenAt'>): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string; retry: boolean }> {
  const supabase = createClient()
  let upload
  try {
    upload = await supabase.storage.from('pickup-evidence').upload(item.photoPath, item.photo, { contentType: 'image/jpeg' })
  } catch (e) {
    if (looksOffline(e)) throw new NetworkError()
    throw e
  }
  if (upload.error) {
    const msg = upload.error.message ?? ''
    const status = String((upload.error as { statusCode?: string | number }).statusCode ?? '')
    if (!/exists|duplicate/i.test(msg) && status !== '409') {
      if (looksOffline(upload.error)) throw new NetworkError()
      return { ok: false, error: "The photo didn't upload. Please take it again.", retry: false }
    }
  }
  let res: Response
  try {
    res = await fetch(item.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item.body, photoPath: item.photoPath, takenAt: item.takenAt }),
    })
  } catch (e) {
    if (looksOffline(e)) throw new NetworkError()
    throw e
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (res.ok) return { ok: true, data }
  const retry = res.status >= 500 || res.status === 429
  return { ok: false, error: typeof data.error === 'string' ? data.error : 'Trashit could not accept this.', retry }
}

// Try now; if there is no signal, keep it on the phone and say so.
export async function sendOrQueue(input: { kind: OutboxKind; label: string; url: string; body: Record<string, unknown>; photo: Blob; photoPath: string }): Promise<SendResult> {
  const item: OutboxItem = { ...input, id: crypto.randomUUID(), takenAt: new Date().toISOString(), tries: 0 }
  try {
    const r = await deliver(item)
    return 'data' in r ? { status: 'sent', data: r.data } : { status: 'failed', error: r.error }
  } catch (e) {
    if (!(e instanceof NetworkError) && !looksOffline(e)) return { status: 'failed', error: 'Something went wrong. Please try again.' }
    try {
      await save(item)
      return { status: 'queued' }
    } catch {
      return { status: 'failed', error: 'No signal, and this phone could not keep it. Please try again when you have signal.' }
    }
  }
}

// Sends what is waiting, oldest first (a pickup before the unload that follows it). Stops at the first sign of no signal.
let draining = false
export async function drainOutbox(): Promise<{ sent: number; failed: number }> {
  if (draining || (typeof navigator !== 'undefined' && navigator.onLine === false)) return { sent: 0, failed: 0 }
  draining = true
  let sent = 0
  let failed = 0
  try {
    for (const item of await listOutbox()) {
      if (item.error) continue
      try {
        const r = await deliver(item)
        if ('data' in r) {
          await tx('readwrite', (s) => s.delete(item.id))
          sent++
        } else if (!r.retry) {
          await tx('readwrite', (s) => s.put({ ...item, error: r.error, tries: item.tries + 1 }))
          failed++
        } else {
          await tx('readwrite', (s) => s.put({ ...item, tries: item.tries + 1 }))
          break
        }
      } catch {
        break // still no signal
      }
    }
  } finally {
    draining = false
    changed()
  }
  return { sent, failed }
}
