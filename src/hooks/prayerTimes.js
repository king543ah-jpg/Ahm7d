// Prayer-time astronomy — computed locally from latitude/longitude
// (standard solar-angle method used by official Islamic calendars).

const rad = (d) => (d * Math.PI) / 180
const deg = (r) => (r * 180) / Math.PI
const sin = (d) => Math.sin(rad(d))
const cos = (d) => Math.cos(rad(d))
const tan = (d) => Math.tan(rad(d))
const arcsin = (x) => deg(Math.asin(x))
const arccos = (x) => deg(Math.acos(x))
const arctan2 = (y, x) => deg(Math.atan2(y, x))
const arccot = (x) => deg(Math.atan(1 / x))
const fix = (a, b) => {
  const r = a - b * Math.floor(a / b)
  return r < 0 ? r + b : r
}

function julian(y, m, d) {
  if (m <= 2) { y -= 1; m += 12 }
  const A = Math.floor(y / 100)
  const B = 2 - A + Math.floor(A / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5
}

function sunPosition(jd) {
  const D = jd - 2451545.0
  const g = fix(357.529 + 0.98560028 * D, 360)
  const q = fix(280.459 + 0.98564736 * D, 360)
  const L = fix(q + 1.915 * sin(g) + 0.02 * sin(2 * g), 360)
  const e = 23.439 - 0.00000036 * D
  const RA = arctan2(cos(e) * sin(L), cos(L)) / 15
  const eqt = q / 15 - fix(RA, 24)
  const decl = arcsin(sin(e) * sin(L))
  return { decl, eqt }
}

// ── Calculation methods ──
export const METHODS = {
  egypt:   { name: 'الهيئة المصرية العامة للمساحة', fajr: 19.5, isha: 17.5 },
  makkah:  { name: 'أم القرى — مكة المكرمة', fajr: 18.5, ishaMin: 90 },
  mwl:     { name: 'رابطة العالم الإسلامي', fajr: 18, isha: 17 },
  gulf:    { name: 'الإمارات والخليج', fajr: 18.2, isha: 18.2 },
  kuwait:  { name: 'الكويت', fajr: 18, isha: 17.5 },
  qatar:   { name: 'قطر', fajr: 18, ishaMin: 90 },
  jordan:  { name: 'الأردن والشام', fajr: 18, isha: 18 },
  morocco: { name: 'المغرب العربي', fajr: 19, isha: 17 },
  karachi: { name: 'جامعة العلوم الإسلامية — كراتشي', fajr: 18, isha: 18 },
  turkey:  { name: 'رئاسة الشؤون الدينية التركية', fajr: 18, isha: 17 },
  isna:    { name: 'أمريكا الشمالية (ISNA)', fajr: 15, isha: 15 },
  france:  { name: 'فرنسا (اتحاد المنظمات الإسلامية)', fajr: 12, isha: 12 },
}

const COUNTRY_METHOD = {
  eg: 'egypt', sd: 'egypt', ly: 'egypt', ss: 'egypt',
  sa: 'makkah', ye: 'makkah',
  ae: 'gulf', om: 'gulf', bh: 'gulf',
  kw: 'kuwait', qa: 'qatar',
  jo: 'jordan', ps: 'jordan', sy: 'jordan', lb: 'jordan',
  ma: 'morocco', dz: 'morocco', tn: 'morocco', mr: 'morocco',
  pk: 'karachi', in: 'karachi', bd: 'karachi', af: 'karachi',
  tr: 'turkey',
  us: 'isna', ca: 'isna',
  fr: 'france',
}
const HANAFI_COUNTRIES = new Set(['pk', 'in', 'bd', 'af'])

/** Pick the method for saved settings: manual choice, or the country's official one. */
export function resolveMethod(settings) {
  const cc = String(settings?.countryCode || '').toLowerCase()
  const manual = settings?.methodKey && settings.methodKey !== 'auto' && METHODS[settings.methodKey]
  const key = manual ? settings.methodKey : COUNTRY_METHOD[cc] || 'mwl'
  return { key, ...METHODS[key], asr: HANAFI_COUNTRIES.has(cc) ? 'hanafi' : 'standard', auto: !manual }
}

export const PRAYER_ORDER = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
export const PRAYERS_NOTIFY = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']

const NAMES = {
  fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء',
}

/** Arabic name — Dhuhr on Friday is shown as Jumu'ah. */
export function prayerName(key, date) {
  if (key === 'dhuhr' && date && date.getDay() === 5) return 'الجمعة'
  return NAMES[key]
}

export function dayKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatTime(date) {
  if (!date) return '--:--'
  return date.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })
}

/**
 * Compute the six times for the calendar day of `date` (device-local date)
 * at lat/lng. Returns { fajr, sunrise, dhuhr, asr, maghrib, isha } as real
 * Date objects (absolute instants), or null where the sun never rises/sets.
 */
export function computeDay(date, lat, lng, method) {
  const y = date.getFullYear()
  const mo = date.getMonth() + 1
  const d = date.getDate()
  const jd = julian(y, mo, d) - lng / (15 * 24)

  const midDay = (t) => fix(12 - sunPosition(jd + t).eqt, 24)
  const angleTime = (angle, t, ccw) => {
    const { decl } = sunPosition(jd + t)
    const noon = midDay(t)
    const v = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))
    if (v < -1 || v > 1) return NaN
    const T = arccos(v) / 15
    return noon + (ccw ? -T : T)
  }
  const asrTime = (factor, t) => {
    const { decl } = sunPosition(jd + t)
    const angle = -arccot(factor + tan(Math.abs(lat - decl)))
    return angleTime(angle, t)
  }
  const p = (h) => h / 24

  const sunrise = angleTime(0.833, p(6), true)
  const sunset = angleTime(0.833, p(18))
  if (isNaN(sunrise) || isNaN(sunset)) return null

  let fajr = angleTime(method.fajr, p(5), true)
  const dhuhr = midDay(p(12))
  const asr = asrTime(method.asr === 'hanafi' ? 2 : 1, p(13))
  const maghrib = sunset
  let isha = method.ishaMin ? sunset + method.ishaMin / 60 : angleTime(method.isha, p(18))

  // High-latitude safety (angle-based portion of the night)
  const night = fix(sunrise - sunset, 24)
  const fajrMax = (method.fajr / 60) * night
  if (isNaN(fajr) || fix(sunrise - fajr, 24) > fajrMax) fajr = sunrise - fajrMax
  if (!method.ishaMin) {
    const ishaMax = (method.isha / 60) * night
    if (isNaN(isha) || fix(isha - sunset, 24) > ishaMax) isha = sunset + ishaMax
  }

  const base = Date.UTC(y, mo - 1, d)
  const toDate = (h) => {
    const ms = base + (h - lng / 15) * 3600000
    return new Date(Math.round(ms / 60000) * 60000)
  }
  return {
    fajr: toDate(fajr),
    sunrise: toDate(sunrise),
    dhuhr: toDate(dhuhr),
    asr: toDate(asr),
    maghrib: toDate(maghrib),
    isha: toDate(isha),
  }
}

/** How long (minutes) a prayer stays "current" after its adhan before the screen moves on. */
export const ELAPSED_WINDOW_MIN = 60

/**
 * The prayer whose adhan passed within the last `windowMin` minutes (sunrise excluded),
 * or null. Checks yesterday too so a late Isha just after midnight still counts.
 */
export function recentPrayer(lat, lng, method, now = new Date(), windowMin = ELAPSED_WINDOW_MIN) {
  const limit = windowMin * 60000
  for (let i = 0; i >= -1; i--) {
    const day = new Date(now)
    day.setDate(day.getDate() + i)
    const t = computeDay(day, lat, lng, method)
    if (!t) continue
    for (let j = PRAYERS_NOTIFY.length - 1; j >= 0; j--) {
      const k = PRAYERS_NOTIFY[j]
      const diff = now - t[k]
      if (diff >= 0) {
        return diff < limit ? { key: k, at: t[k], day } : null
      }
    }
  }
  return null
}

/** The next upcoming prayer (sunrise excluded) from `now`. */
export function nextPrayer(lat, lng, method, now = new Date()) {
  for (let i = 0; i < 2; i++) {
    const day = new Date(now)
    day.setDate(day.getDate() + i)
    const t = computeDay(day, lat, lng, method)
    if (!t) continue
    for (const k of PRAYERS_NOTIFY) {
      if (t[k] > now) return { key: k, at: t[k], day }
    }
  }
  return null
}