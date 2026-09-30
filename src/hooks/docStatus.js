// Document expiry-status helpers — plain utilities (no JSX).

/** Whole days from today until a 'YYYY-MM-DD' date (negative = past). null if no date. */
export function daysUntil(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = String(dateStr).split('-').map(Number)
  if (!y || !m || !d) return null
  const target = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

/** 'ok' | 'soon' | 'expired' | 'none' */
export function statusOf(expiryDate) {
  const n = daysUntil(expiryDate)
  if (n === null) return 'none'
  if (n < 0) return 'expired'
  if (n <= 3) return 'soon'
  return 'ok'
}

export const STATUS_META = {
  ok: {
    label: 'سارية',
    dot: '🟢',
    badge: 'bg-green-100 text-green-800 border-green-300',
    bar: 'bg-green-500',
  },
  soon: {
    label: 'قريبة الانتهاء',
    dot: '🟡',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    bar: 'bg-amber-500',
  },
  expired: {
    label: 'منتهية',
    dot: '🔴',
    badge: 'bg-red-100 text-red-800 border-red-300',
    bar: 'bg-red-500',
  },
  none: {
    label: 'بدون تاريخ انتهاء',
    dot: '⚪',
    badge: 'bg-stone-100 text-stone-600 border-stone-300',
    bar: 'bg-stone-300',
  },
}

/** Human Arabic description of remaining time. */
export function remainingText(expiryDate) {
  const n = daysUntil(expiryDate)
  if (n === null) return 'لم يُحدد تاريخ انتهاء'
  if (n < 0) return `منتهية منذ ${n === -1 ? 'يوم واحد' : `${Math.abs(n)} يوم`}`
  if (n === 0) return 'تنتهي اليوم!'
  if (n === 1) return 'تنتهي غداً'
  if (n === 2) return 'يتبقى يومان'
  if (n <= 10) return `يتبقى ${n} أيام`
  return `يتبقى ${n} يوماً`
}

/** Format 'YYYY-MM-DD' as a readable Arabic date. */
export function formatArDate(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = String(dateStr).split('-').map(Number)
  if (!y || !m || !d) return dateStr
  try {
    return new Date(y, m - 1, d).toLocaleDateString('ar', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}