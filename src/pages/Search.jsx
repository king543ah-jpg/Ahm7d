import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Search as SearchIcon, X, Loader2, SlidersHorizontal, Folder as FolderIcon, ChevronLeft, FileSearch, CalendarDays, Paperclip, Link2 } from 'lucide-react'
import { db } from '../lib/db'
import { useLive } from '../lib/useLive'
import { formatArDate, remainingText, statusOf, STATUS_META } from '../hooks/docStatus'
import StatusBadge from '../components/StatusBadge'

const STATUS_FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'ok', label: '🟢 سارية' },
  { id: 'soon', label: '🟡 قريبة الانتهاء' },
  { id: 'expired', label: '🔴 منتهية' },
  { id: 'none', label: '⚪ بدون تاريخ' },
]

/** Where did the text match? Returns a short Arabic hint or ''. */
function matchHint(doc, q) {
  if (!q) return ''
  const needle = q.toLowerCase()
  const has = (s) => String(s || '').toLowerCase().includes(needle)
  if (has(doc.name)) return ''
  const f = (doc.customFields || []).find((x) => has(x.label) || has(x.value))
  if (f) return `${f.label || 'حقل'}: ${f.value || ''}`
  const link = (doc.links || []).find((x) => has(x.title) || has(x.url))
  if (link) return `🔗 ${link.title || link.url}`
  const file = (doc.files || []).find((x) => has(x.name))
  if (file) return `📎 ${file.name}`
  const r = (doc.reminders || []).find((x) => has(x.title) || has(x.note))
  if (r) return `🔔 ${r.title || r.note}`
  return ''
}

export default function Search() {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const { data: folders } = useLive('folders')
  const folderName = useMemo(() => {
    const m = {}
    for (const f of folders || []) m[f.id] = f.name
    return m
  }, [folders])

  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [folderId, setFolderId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [results, setResults] = useState(null) // null = not searched yet
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { inputRef.current?.focus() }, [])

  const active = q.trim() || status !== 'all' || folderId || from || to
  const filterCount = (status !== 'all' ? 1 : 0) + (folderId ? 1 : 0) + (from || to ? 1 : 0)

  useEffect(() => {
    if (!active) { setResults(null); setLoading(false); return }
    let alive = true
    setLoading(true)
    setError('')
    const t = setTimeout(async () => {
      try {
        const text = q.trim()
        let rows
        if (text) {
          rows = await db.search('documents', text, { limit: 300 })
        } else {
          const filters = {}
          if (folderId) filters.folderId = folderId
          if (from && to) filters.expiryDate = { between: [from, to] }
          else if (from) filters.expiryDate = { gte: from }
          else if (to) filters.expiryDate = { lte: to }
          rows = await db.select('documents', filters, { limit: 300 })
        }
        // Refine (folder / expiry range / status) — status is derived from the date.
        rows = (rows || []).filter((d) => {
          if (folderId && d.folderId !== folderId) return false
          if (from && (!d.expiryDate || d.expiryDate < from)) return false
          if (to && (!d.expiryDate || d.expiryDate > to)) return false
          if (status !== 'all' && statusOf(d.expiryDate) !== status) return false
          return true
        })
        rows.sort((a, b) => {
          if (!a.expiryDate) return 1
          if (!b.expiryDate) return -1
          return a.expiryDate.localeCompare(b.expiryDate)
        })
        if (alive) setResults(rows)
      } catch (err) {
        console.error(err)
        if (alive) setError('تعذّر البحث الآن — حاول مرة أخرى.')
      } finally {
        if (alive) setLoading(false)
      }
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [q, status, folderId, from, to]) // eslint-disable-line react-hooks/exhaustive-deps

  function clearAll() {
    setQ(''); setStatus('all'); setFolderId(''); setFrom(''); setTo('')
    inputRef.current?.focus()
  }

  return (
    <div className="h-full overflow-y-auto paper-bg">
      <header className="sticky top-0 z-20 border-b border-stone-900/10 bg-[#f6f2e9]/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-4xl px-4 py-3 md:px-8">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              title="عودة"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-stone-900/10 bg-white text-stone-700 transition active:scale-95 hover:bg-stone-50"
            >
              <ArrowRight size={22} />
            </button>
            <div className="relative min-w-0 flex-1">
              <SearchIcon size={20} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث بالاسم أو رقم أو كلمة…"
                enterKeyHint="search"
                className="min-h-[52px] w-full rounded-2xl border-2 border-stone-200 bg-white pl-11 pr-12 text-lg font-semibold text-stone-900 outline-none transition focus:border-primary"
              />
              {q && (
                <button
                  onClick={() => { setQ(''); inputRef.current?.focus() }}
                  title="مسح"
                  className="absolute left-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-stone-400 active:scale-90"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters((s) => !s)}
              title="الفلاتر"
              className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 transition active:scale-95 ${showFilters || filterCount ? 'border-primary bg-primary text-white' : 'border-stone-900/10 bg-white text-stone-700 hover:bg-stone-50'}`}
            >
              <SlidersHorizontal size={20} />
              {filterCount > 0 && (
                <span className="absolute -left-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-black text-white">{filterCount}</span>
              )}
            </button>
          </div>

          {/* Status chips — always visible, horizontally scrollable */}
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s.id}
                onClick={() => setStatus(s.id)}
                className={`min-h-[42px] shrink-0 rounded-full px-4 text-sm font-bold transition active:scale-95 ${status === s.id ? 'bg-primary text-white' : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {showFilters && (
            <div className="mt-3 grid grid-cols-1 gap-3 rounded-3xl border border-stone-900/10 bg-white p-4 shadow-sm md:grid-cols-3">
              <label className="block">
                <span className="text-xs font-bold text-stone-500">المجلد</span>
                <select
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="mt-1 min-h-[50px] w-full rounded-xl border-2 border-stone-200 bg-stone-50 px-3 text-base font-bold text-stone-900 outline-none focus:border-primary"
                >
                  <option value="">كل المجلدات</option>
                  {(folders || []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-bold text-stone-500">تنتهي من تاريخ</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-1 min-h-[50px] w-full rounded-xl border-2 border-stone-200 bg-stone-50 px-3 text-base font-bold text-stone-900 outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-stone-500">إلى تاريخ</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-1 min-h-[50px] w-full rounded-xl border-2 border-stone-200 bg-stone-50 px-3 text-base font-bold text-stone-900 outline-none focus:border-primary"
                />
              </label>
              {filterCount > 0 && (
                <button
                  onClick={clearAll}
                  className="min-h-[46px] rounded-xl border-2 border-stone-200 text-sm font-bold text-stone-600 transition active:scale-95 hover:bg-stone-50 md:col-span-3"
                >
                  مسح كل الفلاتر
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-5 md:px-8">
        {error && <div className="mb-4 rounded-2xl bg-red-100 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

        {!active ? (
          <div className="mt-12 flex flex-col items-center text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
              <FileSearch size={44} className="text-primary" />
            </div>
            <h2 className="font-display mt-5 text-2xl font-bold text-stone-800">ابحث في كل وثائقك</h2>
            <p className="mt-2 max-w-sm text-base leading-relaxed text-stone-500">
              اكتب اسم الوثيقة، أو أي رقم أو كلمة في معلوماتها الإضافية مثل رقم الجواز، أو اختر حالة أو فترة تاريخ الانتهاء.
            </p>
          </div>
        ) : loading && !results ? (
          <div className="mt-12 flex justify-center text-stone-500"><Loader2 className="animate-spin" size={28} /></div>
        ) : results && results.length === 0 ? (
          <div className="mt-12 flex flex-col items-center text-center">
            <SearchIcon size={40} className="text-stone-300" />
            <p className="mt-4 text-lg font-bold text-stone-600">لا توجد نتائج مطابقة</p>
            <button onClick={clearAll} className="mt-3 min-h-[46px] rounded-2xl bg-primary/10 px-5 font-bold text-primary active:scale-95">
              مسح البحث
            </button>
          </div>
        ) : results ? (
          <>
            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-stone-500">
              {results.length} نتيجة {loading && <Loader2 size={14} className="animate-spin" />}
            </p>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {results.map((d) => {
                const hint = matchHint(d, q.trim())
                const meta = STATUS_META[statusOf(d.expiryDate)]
                return (
                  <li key={d.id}>
                    <Link
                      to={`/folder/${d.folderId}/doc/${d.id}`}
                      className="group relative flex items-stretch overflow-hidden rounded-3xl border border-stone-900/10 bg-white shadow-sm transition hover:shadow-md active:scale-[0.99]"
                    >
                      <span className={`w-1.5 shrink-0 ${meta.bar}`} />
                      <div className="min-w-0 flex-1 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-display truncate text-lg font-bold text-stone-900">{d.name}</h3>
                          <StatusBadge expiryDate={d.expiryDate} />
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-stone-500">
                          <FolderIcon size={14} /> {folderName[d.folderId] || 'مجلد'}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-stone-700">
                          <CalendarDays size={14} className="text-primary" />
                          {d.expiryDate ? `${formatArDate(d.expiryDate)} · ${remainingText(d.expiryDate)}` : 'بدون تاريخ انتهاء'}
                        </p>
                        {hint && <p className="mt-2 truncate rounded-xl bg-secondary/10 px-3 py-1.5 text-sm font-bold text-secondary" dir="auto">{hint}</p>}
                        <div className="mt-2 flex gap-3 text-xs font-bold text-stone-400">
                          {Array.isArray(d.files) && d.files.length > 0 && <span className="flex items-center gap-1"><Paperclip size={12} /> {d.files.length}</span>}
                          {Array.isArray(d.links) && d.links.length > 0 && <span className="flex items-center gap-1"><Link2 size={12} /> {d.links.length}</span>}
                        </div>
                      </div>
                      <ChevronLeft size={20} className="my-auto ml-3 shrink-0 text-stone-300 transition group-hover:text-primary" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        ) : null}
      </main>
    </div>
  )
}