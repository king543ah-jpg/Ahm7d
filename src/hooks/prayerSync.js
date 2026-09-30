// Prayer settings (saved on the user's account) + real server-side
// push reminders 5 minutes before each adhan, kept topped-up a week ahead.
import { db } from '../lib/db'
import { push } from '../lib/push'
import { maps } from '../lib/maps'
import { computeDay, resolveMethod, PRAYERS_NOTIFY, prayerName, dayKey, formatTime } from './prayerTimes'
import { DEFAULT_PRAYER_SOUND } from './sounds'

const COLL = 'prayer_settings'
const ID = 'me'
export const REMIND_MIN = 5
const DAYS_AHEAD = 6          // today + 6 days
const MOVE_KM = 20            // treat as a new city beyond this distance

export async function loadPrayerSettings() {
  try {
    return (await db.get(COLL, ID)) || null
  } catch {
    return null
  }
}

export async function savePrayerSettings(patch) {
  await db.upsert(COLL, patch, ID)
  return loadPrayerSettings()
}

/** Ask for GPS, resolve city/country. Throws on permission denial. */
export async function detectLocation() {
  const { lat, lng } = await maps.getCurrentLocation({ timeout: 15000 })
  let city = ''
  let country = ''
  let countryCode = ''
  try {
    const { details } = await maps.reverseGeocode(lat, lng)
    city = details.city || details.town || details.village || details.suburb || details.county || details.state || ''
    country = details.country || ''
    countryCode = (details.country_code || '').toLowerCase()
  } catch { /* name lookup is optional */ }
  return { lat, lng, city, country, countryCode, locatedAt: Date.now() }
}

/** Whether the browser already allows location (so we can refresh silently). */
export async function locationAlreadyAllowed() {
  try {
    if (!navigator.permissions?.query) return false
    const st = await navigator.permissions.query({ name: 'geolocation' })
    return st.state === 'granted'
  } catch {
    return false
  }
}

/**
 * If location permission is already granted, re-read GPS quietly; when the
 * user moved to another city, save it and rebuild the reminders.
 * Returns the (possibly updated) settings.
 */
export async function refreshLocationIfMoved(settings) {
  if (!settings || settings.lat == null) return settings
  if (!(await locationAlreadyAllowed())) return settings
  try {
    const { lat, lng } = await maps.getCurrentLocation({ timeout: 12000, highAccuracy: false })
    const km = maps.distance(settings.lat, settings.lng, lat, lng) / 1000
    if (km < MOVE_KM) return settings
    const loc = await detectLocation()
    const next = await savePrayerSettings(loc)
    return (await syncPrayerReminders({ settings: next, reset: true })) || next
  } catch {
    return settings
  }
}

let queue = Promise.resolve()
/** Serialized so the app-open sync and the prayer screen never double-schedule. */
export function syncPrayerReminders(opts = {}) {
  const p = queue.then(() => doSync(opts))
  queue = p.catch(() => {})
  return p
}

async function doSync({ settings, reset = false } = {}) {
  // Always re-read the saved copy so a queued run sees the latest schedule list.
  const s = (await loadPrayerSettings()) || settings
  if (!s) return null
  const now = Date.now()
  const before = Array.isArray(s.scheduled) ? s.scheduled : []
  let list = before.filter((e) => e && e.at > now)

  // Turned off, no location, or location/method changed → cancel what's queued.
  if (reset || !s.enabled || s.lat == null) {
    for (let i = 0; i < list.length; i += 6) {
      await Promise.all(list.slice(i, i + 6).map((e) => push.cancelSchedule(e.id).catch(() => {})))
    }
    list = []
    if (!s.enabled || s.lat == null) {
      if (before.length) return savePrayerSettings({ scheduled: [] })
      return s
    }
  }

  const diag = push.diagnose()
  if (!diag.supported || diag.embedded || diag.permission !== 'granted') {
    if (list.length !== before.length) return savePrayerSettings({ scheduled: list })
    return s
  }

  // Fill EVERY missing reminder (not just the far end of the week) — so a
  // prayer whose reminder failed to schedule earlier (e.g. Maghrib) is retried.
  const have = new Set(list.map((e) => e.key))
  const method = resolveMethod(s)
  const place = s.city || s.country || ''
  const todo = []
  for (let i = 0; i <= DAYS_AHEAD; i++) {
    const day = new Date()
    day.setDate(day.getDate() + i)
    const times = computeDay(day, s.lat, s.lng, method)
    if (!times) continue
    for (const k of PRAYERS_NOTIFY) {
      const key = `${dayKey(day)}-${k}`
      if (have.has(key)) continue
      const fireAt = times[k].getTime() - REMIND_MIN * 60000
      if (fireAt <= now + 30000) continue
      todo.push({ key, k, day, fireAt, prayerAt: times[k] })
    }
  }

  if (!todo.length) {
    if (list.length !== before.length) return savePrayerSettings({ scheduled: list })
    return s
  }

  // Soonest first, a few at a time; stop at the first failures so the nearest
  // prayers are always covered and the rest is retried on the next app open.
  todo.sort((a, b) => a.fireAt - b.fireAt)
  const sound = s.sound || DEFAULT_PRAYER_SOUND
  for (let i = 0; i < todo.length; i += 3) {
    const chunk = todo.slice(i, i + 3)
    const res = await Promise.all(
      chunk.map(async (t) => {
        const name = prayerName(t.k, t.day)
        try {
          const { id } = await push.schedule({
            at: new Date(t.fireAt),
            title: `🕌 اقترب وقت صلاة ${name}`,
            body: `بقي ${REMIND_MIN} دقائق على أذان ${name} (${formatTime(t.prayerAt)})${place ? ` — ${place}` : ''}`,
            url: '#/prayer',
            sound,
          })
          return id ? { id, at: t.fireAt, key: t.key } : null
        } catch (err) {
          console.warn('[prayer] schedule failed:', err)
          return null
        }
      })
    )
    const ok = res.filter(Boolean)
    list.push(...ok)
    if (ok.length < chunk.length) break
  }
  list.sort((a, b) => a.at - b.at)

  return savePrayerSettings({ scheduled: list, lastSyncAt: now })
}