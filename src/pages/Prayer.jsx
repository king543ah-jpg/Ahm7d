import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, MapPin, BellRing, BellOff, LocateFixed, Loader2, X, MoonStar, Sunrise, Settings2, Volume2 } from 'lucide-react'
import SoundPicker from '../components/SoundPicker'
import { DEFAULT_PRAYER_SOUND } from '../hooks/sounds'
import { push } from '../lib/push'
import {
  METHODS, PRAYER_ORDER, computeDay, resolveMethod, prayerName, formatTime, nextPrayer,
  recentPrayer, ELAPSED_WINDOW_MIN,
} from '../hooks/prayerTimes'
import {
  REMIND_MIN, loadPrayerSettings, savePrayerSettings, detectLocation,
  refreshLocationIfMoved, syncPrayerReminders,
} from '../hooks/prayerSync'

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

function countdown(ms) {
  if (ms < 0) ms = 0
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function hijriToday(date) {
  try {
    return date.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return ''
  }
}

export default function Prayer() {
  const navigate = useNavigate()
  const now = useNow(1000)

  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState('')
  const [bellBusy, setBellBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [showIosGuide, setShowIosGuide] = useState(false)
  const [soundBusy, setSoundBusy] = useState(false)
  const [soundNote, setSoundNote] = useState('')
  const customSound = push.diagnose().customSound

  useEffect(() => {
    let alive = true
    ;(async () => {
      const s = await loadPrayerSettings()
      if (!alive) return
      setSettings(s)
      setLoading(false)
      // Traveled? Refresh quietly if location is already allowed.
      const updated = await refreshLocationIfMoved(s)
      if (alive && updated && updated !== s) setSettings(updated)
    })()
    return () => { alive = false }
  }, [])

  const hasLoc = settings && settings.lat != null
  const method = useMemo(() => (settings ? resolveMethod(settings) : null), [settings])
  const dayKeyStr = now.toDateString()
  const today = useMemo(
    () => (hasLoc ? computeDay(new Date(), settings.lat, settings.lng, method) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasLoc, settings?.lat, settings?.lng, method, dayKeyStr]
  )
  const next = hasLoc ? nextPrayer(settings.lat, settings.lng, method, now) : null
  const recent = hasLoc ? recentPrayer(settings.lat, settings.lng, method, now) : null
  const focus = recent || next
  const enabled = !!settings?.enabled

  async function locate() {
    setLocating(true)
    setLocError('')
    try {
      const loc = await detectLocation()
      const saved = await savePrayerSettings(loc)
      setSettings(saved)
      if (saved?.enabled) {
        const synced = await syncPrayerReminders({ settings: saved, reset: true })
        if (synced) setSettings(synced)
      }
    } catch (err) {
      console.error(err)
      setLocError('تعذّر تحديد موقعك — اسمح للتطبيق بالوصول إلى الموقع من إعدادات المتصفح ثم حاول مرة أخرى.')
    } finally {
      setLocating(false)
    }
  }

  async function changeMethod(key) {
    const saved = await savePrayerSettings({ methodKey: key })
    setSettings(saved)
    if (saved?.enabled) {
      const synced = await syncPrayerReminders({ settings: saved, reset: true })
      if (synced) setSettings(synced)
    }
  }

  async function changeSound(id) {
    if (id === (settings?.sound || DEFAULT_PRAYER_SOUND)) return
    setSoundBusy(true)
    setSoundNote('')
    try {
      const saved = await savePrayerSettings({ sound: id })
      setSettings(saved)
      if (saved?.enabled) {
        const synced = await syncPrayerReminders({ settings: saved, reset: true })
        if (synced) setSettings(synced)
      }
      setSoundNote('✅ تم حفظ صوت التنبيه.')
    } catch (err) {
      console.error(err)
      setSoundNote('تعذّر حفظ الصوت — حاول مرة أخرى.')
    } finally {
      setSoundBusy(false)
    }
  }

  async function enableReminders() {
    setBellBusy(true)
    setNotice(null)
    try {
      const d = push.diagnose()
      if (!d.supported) {
        setNotice({ kind: 'warn', text: 'هذا المتصفح لا يدعم التنبيهات.' })
        return
      }
      if (d.embedded) {
        setNotice({ kind: 'warn', text: 'التنبيهات تعمل في التطبيق المنشور فقط — افتح التطبيق من رابطه الرسمي ثم ثبّته على الشاشة الرئيسية.' })
        return
      }
      if (!push.isInstalled() && push.isIOS()) {
        setShowIosGuide(true)
        return
      }
      if (!push.isInstalled() && push.canInstall()) {
        await push.promptInstall()
      }
      const perm = await push.requestPermission()
      if (perm !== 'granted') {
        setNotice({ kind: 'warn', text: 'تم حظر التنبيهات — يمكنك تفعيلها من إعدادات المتصفح.' })
        return
      }
      await push.subscribe()
      const saved = await savePrayerSettings({ enabled: true })
      const synced = await syncPrayerReminders({ settings: saved, reset: true })
      setSettings(synced || saved)
      const count = (synced?.scheduled || []).length
      setNotice({
        kind: 'ok',
        text: count
          ? `✅ تم التفعيل! سيصلك تنبيه قبل كل أذان بـ${REMIND_MIN} دقائق.`
          : 'تم التفعيل، لكن تعذّرت جدولة التنبيهات الآن — حاول مرة أخرى بعد قليل.',
      })
    } catch (err) {
      console.error(err)
      setNotice({ kind: 'warn', text: 'تعذّر تفعيل التنبيهات — حاول مرة أخرى.' })
    } finally {
      setBellBusy(false)
    }
  }

  async function disableReminders() {
    setBellBusy(true)
    setNotice(null)
    try {
      const saved = await savePrayerSettings({ enabled: false })
      const synced = await syncPrayerReminders({ settings: saved })
      setSettings(synced || saved)
      setNotice({ kind: 'ok', text: 'تم إيقاف تنبيهات الصلاة.' })
    } catch (err) {
      console.error(err)
      setNotice({ kind: 'warn', text: 'تعذّر الإيقاف — حاول مرة أخرى.' })
    } finally {
      setBellBusy(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto paper-bg">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-stone-900/10 bg-[#f6f2e9]/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 md:px-8">
          <button
            onClick={() => navigate('/')}
            title="عودة"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-stone-900/10 bg-white text-stone-700 transition active:scale-95 hover:bg-stone-50"
          >
            <ArrowRight size={22} />
          </button>
          <div className="min-w-0">
            <h1 className="font-display text-xl font-extrabold leading-tight text-stone-900 md:text-2xl">مواقيت الصلاة</h1>
            <p className="truncate text-xs text-stone-500">حسب موقعك الحالي</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-5 md:px-8">
        {loading ? (
          <div className="mt-16 flex justify-center text-stone-400"><Loader2 className="animate-spin" size={32} /></div>
        ) : !hasLoc ? (
          /* Empty state — ask for location */
          <div className="mt-6 flex flex-col items-center rounded-[2rem] border border-stone-900/10 bg-white px-6 py-10 text-center shadow-sm">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MapPin size={44} />
            </div>
            <h2 className="font-display mt-5 text-2xl font-extrabold text-stone-900">حدّد موقعك أولاً</h2>
            <p className="mt-2 max-w-sm text-base leading-relaxed text-stone-500">
              نحسب مواقيت الأذان بدقة حسب مدينتك وبطريقة الحساب الرسمية لبلدك — مثلاً في مصر حسب الهيئة المصرية العامة للمساحة.
            </p>
            <button
              onClick={locate}
              disabled={locating}
              className="mt-6 flex min-h-[60px] w-full max-w-sm items-center justify-center gap-3 rounded-3xl bg-primary text-xl font-bold text-white shadow-lg shadow-primary/25 transition active:scale-[0.98] hover:opacity-90 disabled:opacity-60"
            >
              {locating ? <Loader2 className="animate-spin" size={24} /> : <LocateFixed size={24} />}
              {locating ? 'جارٍ تحديد الموقع…' : 'تحديد موقعي'}
            </button>
            {locError && <p className="mt-4 max-w-sm text-sm font-semibold text-red-600">{locError}</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Hero — next prayer */}
            <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0d6e5c] via-[#0b5a4c] to-[#083f36] p-6 text-white shadow-xl shadow-primary/25 md:col-span-2 md:p-8">
              <div className="pointer-events-none absolute -left-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-16 right-10 h-52 w-52 rounded-full bg-[#d99120]/25 blur-3xl" />
              <MoonStar className="absolute left-6 top-6 text-[#f3c979]/70" size={40} />
              <div className="relative">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-white/75">
                  <MapPin size={15} />
                  {[settings.city, settings.country].filter(Boolean).join('، ') || 'موقعك الحالي'}
                </p>
                <p className="mt-1 text-sm text-white/60">{hijriToday(now)}</p>
                {recent ? (
                  <>
                    <p className="mt-5 inline-flex items-center gap-2 text-base font-semibold text-white/80">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f3c979] opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#f3c979]" />
                      </span>
                      حان وقت الصلاة
                    </p>
                    <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-1">
                      <h2 className="font-display text-5xl font-black leading-none md:text-6xl">{prayerName(recent.key, recent.day)}</h2>
                      <span className="font-display text-2xl font-bold text-[#f3c979] md:text-3xl">{formatTime(recent.at)}</span>
                    </div>
                    <div className="mt-5 inline-flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-2.5 backdrop-blur">
                      <span className="text-sm font-semibold text-white/70">مضى على الأذان</span>
                      <span dir="ltr" className="font-display text-2xl font-extrabold tabular-nums tracking-wider">
                        {countdown(now - recent.at)}
                      </span>
                    </div>
                    {/* progress through the hour, then it moves to the next adhan */}
                    <div className="mt-4 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-white/15">
                      <div
                        className="h-full rounded-full bg-[#f3c979] transition-[width] duration-1000"
                        style={{ width: `${Math.min(100, ((now - recent.at) / (ELAPSED_WINDOW_MIN * 60000)) * 100)}%` }}
                      />
                    </div>
                    {next && (
                      <p className="mt-3 text-sm font-semibold text-white/70">
                        الصلاة القادمة: {prayerName(next.key, next.day)} {formatTime(next.at)} — بعد{' '}
                        <span dir="ltr" className="tabular-nums">{countdown(next.at - now)}</span>
                      </p>
                    )}
                  </>
                ) : next ? (
                  <>
                    <p className="mt-5 text-base font-semibold text-white/80">الصلاة القادمة</p>
                    <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-1">
                      <h2 className="font-display text-5xl font-black leading-none md:text-6xl">{prayerName(next.key, next.day)}</h2>
                      <span className="font-display text-2xl font-bold text-[#f3c979] md:text-3xl">{formatTime(next.at)}</span>
                    </div>
                    <div className="mt-5 inline-flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-2.5 backdrop-blur">
                      <span className="text-sm font-semibold text-white/70">متبقٍ</span>
                      <span dir="ltr" className="font-display text-2xl font-extrabold tabular-nums tracking-wider">
                        {countdown(next.at - now)}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="mt-6 text-lg font-semibold">تعذّر حساب المواقيت لهذا الموقع.</p>
                )}
              </div>
            </section>

            {/* Today's times */}
            <section className="rounded-[2rem] border border-stone-900/10 bg-white p-4 shadow-sm md:p-5">
              <h3 className="font-display px-2 pb-2 text-lg font-bold text-stone-800">مواقيت اليوم</h3>
              <ul className="flex flex-col gap-2">
                {today && PRAYER_ORDER.map((k) => {
                  const isNext = focus && focus.key === k && focus.at.getTime() === today[k].getTime()
                  const isCurrent = isNext && !!recent
                  const passed = today[k] < now && !isNext
                  const isSunrise = k === 'sunrise'
                  return (
                    <li
                      key={k}
                      className={`flex min-h-[60px] items-center justify-between rounded-2xl px-4 transition ${
                        isNext
                          ? 'bg-primary text-white shadow-md shadow-primary/25'
                          : isSunrise
                            ? 'bg-amber-50 text-amber-900'
                            : 'bg-stone-50 text-stone-800'
                      } ${passed ? 'opacity-55' : ''}`}
                    >
                      <span className="flex items-center gap-3">
                        {isSunrise ? <Sunrise size={20} /> : (
                          <span className={`h-2.5 w-2.5 rounded-full ${isNext ? 'bg-[#f3c979]' : 'bg-primary/40'}`} />
                        )}
                        <span className="font-display text-lg font-bold">{prayerName(k, now)}</span>
                        {isNext && (
                          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
                            {isCurrent ? 'الآن' : 'القادمة'}
                          </span>
                        )}
                      </span>
                      <span className="font-display text-xl font-extrabold tabular-nums">{formatTime(today[k])}</span>
                    </li>
                  )
                })}
              </ul>
            </section>

            {/* Reminders + settings */}
            <div className="flex flex-col gap-5">
              <section className="rounded-[2rem] border border-stone-900/10 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${enabled ? 'bg-primary/10 text-primary' : 'bg-secondary/15 text-secondary'}`}>
                    {enabled ? <BellRing size={24} /> : <BellOff size={24} />}
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold text-stone-900">تنبيه قبل الأذان</h3>
                    <p className="mt-1 text-sm leading-relaxed text-stone-500">
                      {enabled
                        ? `مفعّل — يصلك إشعار قبل كل صلاة بـ${REMIND_MIN} دقائق حتى لو كان التطبيق مغلقاً.`
                        : `استلم إشعاراً قبل كل أذان بـ${REMIND_MIN} دقائق حسب توقيت مدينتك.`}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-stone-400">
                      الفجر • الظهر • العصر • المغرب • العشاء
                    </p>
                  </div>
                </div>
                <button
                  onClick={enabled ? disableReminders : enableReminders}
                  disabled={bellBusy}
                  className={`mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-lg font-bold transition active:scale-[0.98] disabled:opacity-60 ${
                    enabled
                      ? 'border-2 border-stone-200 text-stone-600 hover:bg-stone-50'
                      : 'bg-primary text-white shadow-md shadow-primary/25 hover:opacity-90'
                  }`}
                >
                  {bellBusy && <Loader2 className="animate-spin" size={20} />}
                  {enabled ? 'إيقاف التنبيهات' : 'تفعيل التنبيهات'}
                </button>
                {notice && (
                  <div className={`mt-3 flex items-start justify-between gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${notice.kind === 'ok' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                    <span>{notice.text}</span>
                    <button onClick={() => setNotice(null)} className="shrink-0 opacity-60"><X size={16} /></button>
                  </div>
                )}
                {enabled && (
                  <p className="mt-3 text-xs leading-relaxed text-stone-400">
                    تُجدَّد التنبيهات تلقائياً لأسبوع قادم في كل مرة تفتح فيها التطبيق — افتحه مرة كل بضعة أيام لتستمر دون انقطاع.
                  </p>
                )}
              </section>

              <section className="rounded-[2rem] border border-stone-900/10 bg-white p-5 shadow-sm">
                <h3 className="font-display flex items-center gap-2 text-lg font-bold text-stone-900">
                  <Volume2 size={20} className="text-stone-400" /> صوت تنبيه الصلاة
                  {soundBusy && <Loader2 size={18} className="animate-spin text-primary" />}
                </h3>
                <p className="mb-3 mt-1 text-sm leading-relaxed text-stone-500">اختر الصوت واضغط ▶ للاستماع إليه.</p>
                <SoundPicker value={settings.sound || DEFAULT_PRAYER_SOUND} onChange={changeSound} disabled={soundBusy} />
                {soundNote && <p className="mt-3 text-sm font-bold text-primary">{soundNote}</p>}
                <p className="mt-3 text-xs leading-relaxed text-stone-400">
                  {customSound
                    ? 'يرن الإشعار بالصوت المختار حتى والتطبيق مغلق (ما لم يكن الهاتف على الصامت).'
                    : 'عندما يكون التطبيق مفتوحاً يُسمع الصوت المختار. وهو مغلق يرن الإشعار بنغمة الهاتف العادية — والصوت المختار يعمل مع التطبيق المغلق في نسخة المتجر فقط.'}
                </p>
              </section>

              <section className="rounded-[2rem] border border-stone-900/10 bg-white p-5 shadow-sm">
                <h3 className="font-display flex items-center gap-2 text-lg font-bold text-stone-900">
                  <Settings2 size={20} className="text-stone-400" /> الموقع وطريقة الحساب
                </h3>
                <button
                  onClick={locate}
                  disabled={locating}
                  className="mt-4 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary/30 bg-primary/5 text-base font-bold text-primary transition active:scale-[0.98] hover:bg-primary/10 disabled:opacity-60"
                >
                  {locating ? <Loader2 className="animate-spin" size={20} /> : <LocateFixed size={20} />}
                  {locating ? 'جارٍ التحديث…' : 'تحديث موقعي الآن'}
                </button>
                {locError && <p className="mt-2 text-sm font-semibold text-red-600">{locError}</p>}
                <label className="mt-4 block text-sm font-semibold text-stone-600">طريقة الحساب</label>
                <select
                  value={settings.methodKey || 'auto'}
                  onChange={(e) => changeMethod(e.target.value)}
                  className="mt-2 min-h-[54px] w-full rounded-2xl border-2 border-stone-200 bg-stone-50 px-4 text-base font-semibold text-stone-900 outline-none focus:border-primary"
                >
                  <option value="auto">تلقائي حسب البلد{method?.auto ? ` (${method.name})` : ''}</option>
                  {Object.entries(METHODS).map(([k, m]) => (
                    <option key={k} value={k}>{m.name}</option>
                  ))}
                </select>
                <p className="mt-3 text-xs leading-relaxed text-stone-400">
                  إذا سافرت لبلد آخر تتحدّث المواقيت والتنبيهات تلقائياً عند فتح التطبيق، أو اضغط «تحديث موقعي الآن».
                </p>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* iOS install guide */}
      {showIosGuide && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center md:items-center"
          style={{ height: 'var(--visual-height, 100dvh)' }}
          onClick={() => setShowIosGuide(false)}
        >
          <div className="absolute inset-0 bg-black/45" />
          <div
            className="relative w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl md:rounded-3xl"
            style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 2rem)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl font-bold text-stone-900">ثبّت التطبيق أولاً 🔔</h3>
            <ol className="mt-4 list-inside list-decimal space-y-3 text-base leading-relaxed text-stone-700">
              <li>إن كنت تفتح التطبيق داخل نافذة المعاينة، انسخ رابط التطبيق وافتحه في متصفح Safari أولاً.</li>
              <li>اضغط زر «مشاركة» في Safari (المربع مع السهم ⬆️).</li>
              <li>اختر «إضافة إلى الشاشة الرئيسية» ثم «إضافة».</li>
              <li>افتح التطبيق من أيقونته الجديدة، ثم ادخل مواقيت الصلاة واضغط «تفعيل التنبيهات».</li>
            </ol>
            <button
              onClick={() => setShowIosGuide(false)}
              className="mt-6 min-h-[52px] w-full rounded-2xl bg-primary text-lg font-bold text-white transition active:scale-95"
            >
              فهمت
            </button>
          </div>
        </div>
      )}
    </div>
  )
}