// Notification sounds — the sound picked for prayer + document reminders.
// Server pushes carry the chosen `sound` id (played by the phone in the store
// app build); while the app is OPEN we also play it in-app so it's heard on
// the web too.
import { db } from '../lib/db'
import { audio } from '../lib/audio'

export const SOUND_OPTIONS = [
  { id: 'chime', label: 'نغمة هادئة', kind: 'tone' },
  { id: 'bell', label: 'جرس', kind: 'tone' },
  { id: 'alarm', label: 'منبّه', kind: 'tone' },
  { id: 'siren', label: 'صفّارة قوية', kind: 'tone' },
  { id: 'adhan', label: 'الأذان', kind: 'adhan' },
  { id: 'adhan-alafasy', label: 'الأذان — مشاري العفاسي', kind: 'adhan' },
  { id: 'adhan-fakhry', label: 'الأذان — صباح فخري', kind: 'adhan' },
  { id: 'adhan-turkish', label: 'الأذان — المقام التركي', kind: 'adhan' },
]
export const DEFAULT_PRAYER_SOUND = 'adhan'
export const DEFAULT_DOC_SOUND = 'bell'

export function soundLabel(id) {
  return SOUND_OPTIONS.find((s) => s.id === id)?.label || id
}

// ── Per-user app settings (document reminder sound) ──
const APP_COLL = 'app_settings'
const APP_ID = 'me'

export async function loadAppSettings() {
  try {
    return (await db.get(APP_COLL, APP_ID)) || {}
  } catch {
    return {}
  }
}

export async function saveAppSettings(patch) {
  await db.upsert(APP_COLL, patch, APP_ID)
  return loadAppSettings()
}

export async function getDocSound() {
  const s = await loadAppSettings()
  return s.docSound || DEFAULT_DOC_SOUND
}

// ── Playback ──
let current = null // { stop }

export function stopSound() {
  try { current?.stop() } catch {}
  current = null
}

let ctx = null
function audioCtx() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext
    if (!C) return null
    ctx = new C()
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function tone(ac, { type = 'sine', freq, from, to, start, dur, gain = 0.3, out }) {
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = type
  const t0 = ac.currentTime + start
  if (from && to) {
    o.frequency.setValueAtTime(from, t0)
    o.frequency.linearRampToValueAtTime(to, t0 + dur)
  } else {
    o.frequency.setValueAtTime(freq, t0)
  }
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g).connect(out)
  o.start(t0)
  o.stop(t0 + dur + 0.05)
  return o
}

function playTone(id) {
  const ac = audioCtx()
  if (!ac) return null
  const out = ac.createGain()
  out.gain.value = 1
  out.connect(ac.destination)
  const plan = {
    chime: [
      { freq: 880, start: 0, dur: 0.9 },
      { freq: 1318.5, start: 0.18, dur: 1.2 },
      { freq: 1760, start: 0.36, dur: 1.5, gain: 0.18 },
    ],
    bell: [0, 1.1].flatMap((s) => [
      { freq: 660, start: s, dur: 1.6, gain: 0.35 },
      { freq: 1320, start: s, dur: 1.1, gain: 0.12 },
      { freq: 1980, start: s, dur: 0.7, gain: 0.06 },
    ]),
    alarm: [0, 0.3, 0.6, 1.2, 1.5, 1.8].map((s) => ({ type: 'square', freq: 1046, start: s, dur: 0.18, gain: 0.16 })),
    siren: [0, 0.8, 1.6].map((s) => ({ type: 'sawtooth', from: 600, to: 1250, start: s, dur: 0.75, gain: 0.14 })),
  }[id] || []
  const nodes = plan.map((p) => tone(ac, { ...p, out }))
  return {
    stop() {
      nodes.forEach((n) => { try { n.stop() } catch {} })
      try { out.disconnect() } catch {}
    },
  }
}

const ADHAN_HINTS = {
  'adhan-alafasy': ['alafasy', 'afasy', 'عفاسي'],
  'adhan-fakhry': ['fakhry', 'fakhri', 'فخري'],
  'adhan-turkish': ['turk', 'istanbul', 'تركي'],
}

async function adhanUrl(id) {
  const list = await audio.adhan.list().catch(() => [])
  const exact = list.find((t) => t.id === id)
  if (exact) return exact.url
  const hints = ADHAN_HINTS[id]
  if (hints) {
    const hit = list.find((t) => {
      const hay = `${t.id} ${t.title || ''} ${t.reciter || ''}`.toLowerCase()
      return hints.some((h) => hay.includes(h))
    })
    if (hit) return hit.url
  }
  return audio.adhan.default()
}

/**
 * Play a sound id in-app. Adhan voices play the real recording (up to
 * `maxSec` seconds); alert ids play a short synthesized tone.
 * Resolves once playback started (or failed silently).
 */
export async function playSound(id, { maxSec = 40 } = {}) {
  stopSound()
  const opt = SOUND_OPTIONS.find((s) => s.id === id)
  if (!opt) return false
  if (opt.kind === 'tone') {
    current = playTone(id)
    return !!current
  }
  try {
    const url = await adhanUrl(id)
    const el = new Audio(url)
    let timer = null
    const handle = {
      stop() {
        clearTimeout(timer)
        try { el.pause(); el.currentTime = 0 } catch {}
      },
    }
    current = handle
    await el.play()
    if (maxSec) timer = setTimeout(() => { if (current === handle) stopSound() }, maxSec * 1000)
    el.addEventListener('ended', () => { if (current === handle) current = null })
    return true
  } catch (err) {
    console.warn('[sounds] play failed:', err)
    return false
  }
}