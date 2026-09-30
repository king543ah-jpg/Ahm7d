// Document reminders — real server-side push notifications scheduled per document.
//   1) The automatic expiry reminder (3 days before, stored as doc.reminderId).
//   2) Custom reminders the user adds per document (doc.reminders[]):
//        { key, type: 'before', days, time: 'HH:MM', jobId }
//        { key, type: 'date', date: 'YYYY-MM-DD', time: 'HH:MM', title, note, jobId }
import { push } from '../lib/push'
import { db } from '../lib/db'
import { getDocSound } from './sounds'

function pushUsable() {
  const diag = push.diagnose()
  return diag.supported && diag.permission !== 'denied'
}

function parseYMD(s) {
  const [y, m, d] = String(s || '').split('-').map(Number)
  if (!y || !m || !d) return null
  return { y, m, d }
}

function parseHM(s) {
  const [h, mi] = String(s || '09:00').split(':').map(Number)
  return { h: Number.isFinite(h) ? h : 9, mi: Number.isFinite(mi) ? mi : 0 }
}

/**
 * Schedule (or reschedule) the automatic expiry reminder for one document.
 * Fires 3 days before expiry at 09:00 local time; if that moment has
 * already passed but the document is still valid, fires on the expiry
 * morning instead. Returns the schedule id, or null when push isn't available.
 */
export async function scheduleExpiryReminder(doc, previousId, sound) {
  if (previousId) {
    try { await push.cancelSchedule(previousId) } catch { /* already gone */ }
  }

  const ymd = parseYMD(doc.expiryDate)
  if (!ymd) return null
  if (!pushUsable()) return null

  const now = new Date()
  let fireAt = new Date(ymd.y, ymd.m - 1, ymd.d - 3, 9, 0, 0, 0)
  if (fireAt <= now) fireAt = new Date(ymd.y, ymd.m - 1, ymd.d, 9, 0, 0, 0)
  if (fireAt <= now) return null

  try {
    const chosen = sound || (await getDocSound())
    const { id } = await push.schedule({
      at: fireAt,
      title: `⏰ "${doc.name}" على وشك الانتهاء`,
      body: `تنتهي صلاحية الوثيقة بتاريخ ${doc.expiryDate} — تحقق منها الآن.`,
      url: doc.folderId ? `#/folder/${doc.folderId}/doc/${doc.id || ''}` : '#/',
      sound: chosen,
    })
    return id
  } catch (err) {
    console.warn('[reminders] schedule failed:', err)
    return null
  }
}

/** When a custom reminder fires (Date), or null if it can't be computed. */
export function customReminderFireAt(r, expiryDate) {
  const { h, mi } = parseHM(r.time)
  if (r.type === 'before') {
    const ymd = parseYMD(expiryDate)
    const days = Number(r.days)
    if (!ymd || !Number.isFinite(days) || days < 0) return null
    return new Date(ymd.y, ymd.m - 1, ymd.d - days, h, mi, 0, 0)
  }
  const ymd = parseYMD(r.date)
  if (!ymd) return null
  return new Date(ymd.y, ymd.m - 1, ymd.d, h, mi, 0, 0)
}

/** Short Arabic description of a custom reminder. */
export function describeReminder(r) {
  if (r.type === 'before') {
    const n = Number(r.days) || 0
    const d = n === 0 ? 'يوم الانتهاء' : n === 1 ? 'قبل الانتهاء بيوم' : n === 2 ? 'قبل الانتهاء بيومين' : `قبل الانتهاء بـ ${n} ${n <= 10 ? 'أيام' : 'يوماً'}`
    return `${d} — الساعة ${r.time || '09:00'}`
  }
  return `${r.title || 'تذكير'} — ${r.date || '؟'} الساعة ${r.time || '09:00'}`
}

/**
 * Cancel a document's previous custom reminders and schedule the new list.
 * Returns the list with a fresh jobId on each ('' when it could not be
 * scheduled — e.g. already in the past or notifications unavailable).
 */
export async function scheduleCustomReminders(doc, reminders, previous, sound) {
  for (const r of previous || []) {
    if (r?.jobId) {
      try { await push.cancelSchedule(r.jobId) } catch { /* already gone */ }
    }
  }
  const list = Array.isArray(reminders) ? reminders : []
  if (!list.length) return []
  const usable = pushUsable()
  const chosen = usable ? (sound || (await getDocSound())) : null
  const now = new Date()
  const out = []
  for (const r of list) {
    const clean = { ...r, jobId: '' }
    const at = customReminderFireAt(r, doc.expiryDate)
    if (usable && at && at > now) {
      try {
        const isBefore = r.type === 'before'
        const n = Number(r.days) || 0
        const { id } = await push.schedule({
          at,
          title: isBefore ? `🔔 تذكير: «${doc.name}»` : `📌 ${r.title || 'تذكير'} — «${doc.name}»`,
          body: isBefore
            ? (n === 0 ? `تنتهي صلاحية الوثيقة اليوم (${doc.expiryDate}).` : `تنتهي صلاحية الوثيقة بعد ${n} ${n <= 10 ? 'أيام' : 'يوماً'} — بتاريخ ${doc.expiryDate}.`)
            : (r.note || `موعدك الخاص بالوثيقة «${doc.name}».`),
          url: doc.folderId ? `#/folder/${doc.folderId}/doc/${doc.id || ''}` : '#/',
          sound: chosen,
        })
        clean.jobId = id || ''
      } catch (err) {
        console.warn('[reminders] custom schedule failed:', err)
      }
    }
    out.push(clean)
  }
  return out
}

/**
 * After the user picks a new reminder sound: rebuild every document's pending
 * reminders so they ring with the new sound. Returns how many docs were updated.
 */
export async function rescheduleAllExpiryReminders(sound) {
  const docs = await db.selectAll('documents').catch(() => [])
  let n = 0
  for (const doc of docs) {
    const hasCustom = Array.isArray(doc.reminders) && doc.reminders.length > 0
    if (!doc.reminderId && !doc.expiryDate && !hasCustom) continue
    const patch = {}
    const id = await scheduleExpiryReminder(doc, doc.reminderId, sound)
    if ((id || '') !== (doc.reminderId || '')) patch.reminderId = id || ''
    if (hasCustom) {
      patch.reminders = await scheduleCustomReminders(doc, doc.reminders, doc.reminders, sound)
    }
    if (Object.keys(patch).length) await db.update('documents', doc.id, patch).catch(() => {})
    if (id || hasCustom) n++
  }
  return n
}

/** Cancel a document's automatic reminder (kept for existing callers). */
export async function cancelExpiryReminder(reminderId) {
  if (!reminderId) return
  try { await push.cancelSchedule(reminderId) } catch { /* already gone */ }
}

/** Cancel every reminder (automatic + custom) attached to a document. */
export async function cancelDocReminders(doc) {
  if (!doc) return
  await cancelExpiryReminder(doc.reminderId)
  for (const r of Array.isArray(doc.reminders) ? doc.reminders : []) {
    if (r?.jobId) {
      try { await push.cancelSchedule(r.jobId) } catch { /* already gone */ }
    }
  }
}