// App lock — a privacy lock screen for THIS device. Only a salted hash of the
// password is kept on the device; the real protection of the data is still
// the user's account sign-in.
import { useEffect, useState } from 'react'

const KEY = 'app-lock-v1'
const EVENT = 'app-lock-change'
export const RELOCK_AFTER_MS = 60 * 1000 // lock again after 1 minute in background
export const MIN_LEN = 4

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    const c = raw ? JSON.parse(raw) : null
    return c && c.hash && c.salt ? c : null
  } catch {
    return null
  }
}

function emit() {
  try { window.dispatchEvent(new CustomEvent(EVENT)) } catch {}
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Lock config that applies to this signed-in user on this device (or null). */
export function getLock(userId) {
  const c = read()
  if (!c) return null
  if (c.userId && userId && c.userId !== userId) return null
  return c
}

export async function setLockPassword(password, userId) {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const salt = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
  const hash = await sha256(`${salt}:${password}`)
  localStorage.setItem(KEY, JSON.stringify({ salt, hash, userId: userId || null, setAt: Date.now() }))
  emit()
}

export async function verifyLockPassword(password) {
  const c = read()
  if (!c) return true
  return (await sha256(`${c.salt}:${password}`)) === c.hash
}

export function clearLock() {
  try { localStorage.removeItem(KEY) } catch {}
  emit()
}

/** Re-renders when the lock is turned on / off / changed. */
export function useLockConfig(userId) {
  const [cfg, setCfg] = useState(() => getLock(userId))
  useEffect(() => {
    setCfg(getLock(userId))
    const on = () => setCfg(getLock(userId))
    window.addEventListener(EVENT, on)
    window.addEventListener('storage', on)
    return () => {
      window.removeEventListener(EVENT, on)
      window.removeEventListener('storage', on)
    }
  }, [userId])
  return cfg
}