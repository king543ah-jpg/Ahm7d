import { Plus, X, BellPlus, CalendarClock, Hourglass } from 'lucide-react'
import { customReminderFireAt } from '../hooks/reminders'

const QUICK_DAYS = [1, 3, 7, 14, 30, 60, 90]

function newKey() {
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Edit the custom reminders of one document.
 * reminders: [{ key, type: 'before'|'date', days, date, time, title, note, jobId }]
 */
export default function ReminderEditor({ reminders, onChange, expiryDate }) {
  const list = Array.isArray(reminders) ? reminders : []

  function add(type) {
    const base = { key: newKey(), type, time: '09:00', jobId: '' }
    onChange([
      ...list,
      type === 'before'
        ? { ...base, days: 7 }
        : { ...base, date: '', title: 'موعد مراجعة', note: '' },
    ])
  }
  function update(key, patch) {
    onChange(list.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }
  function remove(key) {
    onChange(list.filter((r) => r.key !== key))
  }

  const now = new Date()

  return (
    <div>
      {list.length === 0 ? (
        <p className="text-sm font-semibold text-stone-400">
          أضف تذكيراً خاصاً بهذه الوثيقة — قبل الانتهاء بعدد أيام تختاره، أو في موعد محدد مثل موعد مراجعة أو تجديد.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((r) => {
            const at = customReminderFireAt(r, expiryDate)
            const past = at && at <= now
            const missingExpiry = r.type === 'before' && !expiryDate
            return (
              <li key={r.key} className="rounded-2xl border-2 border-stone-200 bg-stone-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-extrabold text-stone-800">
                    {r.type === 'before' ? <Hourglass size={18} className="text-secondary" /> : <CalendarClock size={18} className="text-primary" />}
                    {r.type === 'before' ? 'قبل تاريخ الانتهاء' : 'في موعد محدد'}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(r.key)}
                    title="حذف التذكير"
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-stone-400 transition hover:bg-red-50 hover:text-red-600 active:scale-90"
                  >
                    <X size={18} />
                  </button>
                </div>

                {r.type === 'before' ? (
                  <>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {QUICK_DAYS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => update(r.key, { days: d })}
                          className={`min-h-[40px] rounded-xl px-3 text-sm font-bold transition active:scale-95 ${Number(r.days) === d ? 'bg-secondary text-white' : 'bg-white text-stone-600 border border-stone-200'}`}
                        >
                          {d === 1 ? 'يوم' : d === 7 ? 'أسبوع' : d === 14 ? 'أسبوعين' : d === 30 ? 'شهر' : d === 60 ? 'شهرين' : d === 90 ? '3 شهور' : `${d} أيام`}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-xs font-bold text-stone-500">عدد الأيام قبل الانتهاء</span>
                        <input
                          type="number"
                          min="0"
                          max="730"
                          inputMode="numeric"
                          value={r.days ?? ''}
                          onChange={(e) => update(r.key, { days: e.target.value === '' ? '' : Math.max(0, Math.min(730, Number(e.target.value))) })}
                          className="mt-1 min-h-[50px] w-full rounded-xl border-2 border-stone-200 bg-white px-3 text-lg font-bold text-stone-900 outline-none focus:border-primary"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-stone-500">الساعة</span>
                        <input
                          type="time"
                          value={r.time || '09:00'}
                          onChange={(e) => update(r.key, { time: e.target.value })}
                          className="mt-1 min-h-[50px] w-full rounded-xl border-2 border-stone-200 bg-white px-3 text-lg font-bold text-stone-900 outline-none focus:border-primary"
                        />
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <input
                      value={r.title || ''}
                      onChange={(e) => update(r.key, { title: e.target.value })}
                      placeholder="عنوان التذكير (مثال: موعد مراجعة الجوازات)"
                      className="mt-2 min-h-[50px] w-full rounded-xl border-2 border-stone-200 bg-white px-3 text-base font-bold text-stone-900 outline-none focus:border-primary"
                    />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-xs font-bold text-stone-500">التاريخ</span>
                        <input
                          type="date"
                          value={r.date || ''}
                          onChange={(e) => update(r.key, { date: e.target.value })}
                          className="mt-1 min-h-[50px] w-full rounded-xl border-2 border-stone-200 bg-white px-3 text-base font-bold text-stone-900 outline-none focus:border-primary"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-stone-500">الساعة</span>
                        <input
                          type="time"
                          value={r.time || '09:00'}
                          onChange={(e) => update(r.key, { time: e.target.value })}
                          className="mt-1 min-h-[50px] w-full rounded-xl border-2 border-stone-200 bg-white px-3 text-base font-bold text-stone-900 outline-none focus:border-primary"
                        />
                      </label>
                    </div>
                    <input
                      value={r.note || ''}
                      onChange={(e) => update(r.key, { note: e.target.value })}
                      placeholder="ملاحظة تظهر في الإشعار (اختياري)"
                      className="mt-2 min-h-[50px] w-full rounded-xl border-2 border-stone-200 bg-white px-3 text-base font-semibold text-stone-900 outline-none focus:border-primary"
                    />
                  </>
                )}

                {missingExpiry ? (
                  <p className="mt-2 text-xs font-bold text-amber-800">حدّد تاريخ الانتهاء أولاً حتى يعمل هذا التذكير.</p>
                ) : r.type === 'date' && !r.date ? (
                  <p className="mt-2 text-xs font-bold text-amber-800">اختر تاريخ التذكير.</p>
                ) : past ? (
                  <p className="mt-2 text-xs font-bold text-amber-800">هذا الموعد مضى بالفعل — لن يُرسل تنبيه.</p>
                ) : at ? (
                  <p className="mt-2 text-xs font-bold text-green-800">
                    🔔 سيصلك التنبيه يوم {at.toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => add('before')}
          className="flex min-h-[50px] items-center justify-center gap-1.5 rounded-2xl bg-secondary/10 text-sm font-bold text-secondary transition active:scale-95 hover:bg-secondary/20"
        >
          <BellPlus size={18} /> قبل الانتهاء
        </button>
        <button
          type="button"
          onClick={() => add('date')}
          className="flex min-h-[50px] items-center justify-center gap-1.5 rounded-2xl bg-primary/10 text-sm font-bold text-primary transition active:scale-95 hover:bg-primary/20"
        >
          <Plus size={18} /> موعد محدد
        </button>
      </div>
    </div>
  )
}