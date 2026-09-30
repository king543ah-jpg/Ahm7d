import { Plus, X, Globe } from 'lucide-react'

/** Adds https:// when the user typed a bare address like "example.com". */
export function normalizeUrl(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return s
  return `https://${s}`
}

export function isValidUrl(raw) {
  const s = normalizeUrl(raw)
  if (!s) return false
  try {
    const u = new URL(s)
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.')
  } catch {
    return false
  }
}

export function hostOf(raw) {
  try {
    return new URL(normalizeUrl(raw)).hostname.replace(/^www\./, '')
  } catch {
    return String(raw || '')
  }
}

/**
 * links: [{ title, url }]
 * onChange(nextLinks)
 */
export default function LinksEditor({ links, onChange }) {
  function add() {
    onChange([...(links || []), { title: '', url: '' }])
  }
  function update(i, key, val) {
    onChange(links.map((l, idx) => (idx === i ? { ...l, [key]: val } : l)))
  }
  function remove(i) {
    onChange(links.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      {(links || []).length === 0 ? (
        <p className="text-sm font-semibold text-stone-400">
          مثل موقع الجوازات أو صفحة حجز موعد التجديد — تفتحه بضغطة من صفحة الوثيقة.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {links.map((l, i) => {
            const bad = l.url.trim() && !isValidUrl(l.url)
            return (
              <li key={i} className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
                <div className="flex items-center gap-2">
                  <input
                    value={l.title}
                    onChange={(e) => update(i, 'title', e.target.value)}
                    placeholder="اسم الرابط (مثال: موقع الجوازات)"
                    className="min-h-[50px] min-w-0 flex-1 rounded-2xl border-2 border-stone-200 bg-white px-3 text-base font-semibold text-stone-900 outline-none transition focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    title="حذف الرابط"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-stone-400 transition hover:bg-red-50 hover:text-red-600 active:scale-90"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="relative mt-2">
                  <Globe size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    value={l.url}
                    onChange={(e) => update(i, 'url', e.target.value)}
                    placeholder="www.example.com"
                    type="url"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    dir="ltr"
                    className={`min-h-[50px] w-full rounded-2xl border-2 bg-white pl-3 pr-10 text-base font-semibold text-stone-900 outline-none transition focus:border-primary ${bad ? 'border-red-300' : 'border-stone-200'}`}
                  />
                </div>
                {bad && <p className="mt-1.5 text-xs font-bold text-red-600">الرابط غير صحيح — اكتبه مثل www.example.com</p>}
              </li>
            )
          })}
        </ul>
      )}
      <button
        type="button"
        onClick={add}
        className="mt-3 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-primary/10 text-base font-bold text-primary transition active:scale-[0.98] hover:bg-primary/20"
      >
        <Plus size={19} /> إضافة رابط
      </button>
    </div>
  )
}