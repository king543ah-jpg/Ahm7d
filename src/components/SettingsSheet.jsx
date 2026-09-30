import { useEffect, useState } from 'react'
import { Lock, LockOpen, KeyRound, Volume2, X, Loader2, ShieldCheck } from 'lucide-react'
import { auth } from '../lib/auth'
import { push } from '../lib/push'
import { useLockConfig, setLockPassword, verifyLockPassword, clearLock, MIN_LEN } from '../hooks/appLock'
import { DEFAULT_DOC_SOUND, loadAppSettings, saveAppSettings } from '../hooks/sounds'
import { rescheduleAllExpiryReminders } from '../hooks/reminders'
import SoundPicker from './SoundPicker'

const inputCls =
  'min-h-[54px] w-full rounded-2xl border-2 border-stone-200 bg-stone-50 px-4 text-lg font-semibold text-stone-900 outline-none transition focus:border-primary focus:bg-white'

function LockSection() {
  const userId = auth.getCurrentUser()?.id
  const cfg = useLockConfig(userId)
  const [mode, setMode] = useState(null) // 'set' | 'change' | 'off'
  const [current, setCurrent] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  function open(m) {
    setMode(m); setCurrent(''); setPw(''); setPw2(''); setError(''); setOk('')
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (mode !== 'set') {
      const valid = await verifyLockPassword(current).catch(() => false)
      if (!valid) { setError('كلمة السر الحالية غير صحيحة'); return }
    }
    if (mode === 'off') {
      clearLock()
      setMode(null)
      setOk('تم إيقاف قفل التطبيق.')
      return
    }
    if (pw.length < MIN_LEN) { setError(`كلمة السر يجب أن تكون ${MIN_LEN} أحرف أو أرقام على الأقل`); return }
    if (pw !== pw2) { setError('كلمتا السر غير متطابقتين'); return }
    setBusy(true)
    try {
      await setLockPassword(pw, userId)
      setMode(null)
      setOk(mode === 'set' ? '🔒 تم تفعيل القفل — سيطلب التطبيق كلمة السر عند فتحه.' : 'تم تغيير كلمة السر.')
    } catch (err) {
      console.error(err)
      setError('تعذّر حفظ كلمة السر — حاول مرة أخرى')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-3xl border border-stone-900/10 bg-white p-5">
      <div className="flex items-start gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${cfg ? 'bg-primary/10 text-primary' : 'bg-stone-100 text-stone-500'}`}>
          {cfg ? <Lock size={22} /> : <LockOpen size={22} />}
        </span>
        <div className="min-w-0">
          <h4 className="font-display text-lg font-bold text-stone-900">قفل التطبيق بكلمة سر</h4>
          <p className="mt-0.5 text-sm font-semibold text-stone-500">
            {cfg ? 'مفعّل — يُطلب عند فتح التطبيق وبعد تركه دقيقة في الخلفية.' : 'غير مفعّل'}
          </p>
        </div>
      </div>

      {ok && !mode && <p className="mt-3 rounded-2xl bg-green-100 px-4 py-2.5 text-sm font-bold text-green-800">{ok}</p>}

      {!mode && (
        <div className="mt-4 flex flex-col gap-2">
          {cfg ? (
            <>
              <button onClick={() => open('change')} className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-2 border-primary/30 bg-primary/5 text-base font-bold text-primary transition active:scale-[0.98] hover:bg-primary/10">
                <KeyRound size={19} /> تغيير كلمة السر
              </button>
              <button onClick={() => open('off')} className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-2 border-stone-200 text-base font-bold text-stone-600 transition active:scale-[0.98] hover:bg-stone-50">
                <LockOpen size={19} /> إيقاف القفل
              </button>
            </>
          ) : (
            <button onClick={() => open('set')} className="flex min-h-[54px] items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-white shadow-md shadow-primary/25 transition active:scale-[0.98] hover:opacity-90">
              <Lock size={20} /> تفعيل القفل
            </button>
          )}
        </div>
      )}

      {mode && (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          {mode !== 'set' && (
            <input type="password" autoFocus value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="كلمة السر الحالية" autoComplete="current-password" className={inputCls} />
          )}
          {mode !== 'off' && (
            <>
              <input type="password" autoFocus={mode === 'set'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="كلمة السر الجديدة" autoComplete="new-password" className={inputCls} />
              <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="أعد كتابة كلمة السر" autoComplete="new-password" className={inputCls} />
            </>
          )}
          {error && <p className="text-sm font-bold text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode(null)} className="min-h-[52px] flex-1 rounded-2xl border-2 border-stone-200 text-base font-bold text-stone-600 transition active:scale-95 hover:bg-stone-50">
              إلغاء
            </button>
            <button type="submit" disabled={busy} className={`flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold text-white transition active:scale-95 disabled:opacity-60 ${mode === 'off' ? 'bg-red-600' : 'bg-primary'}`}>
              {busy && <Loader2 size={18} className="animate-spin" />}
              {mode === 'off' ? 'إيقاف القفل' : 'حفظ'}
            </button>
          </div>
        </form>
      )}

      <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-stone-400">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        القفل خاص بهذا الجهاز. إن نسيت كلمة السر اضغط «نسيت كلمة السر؟» في شاشة القفل، ثم سجّل الدخول بحسابك من جديد.
      </p>
    </section>
  )
}

function DocSoundSection() {
  const [sound, setSound] = useState(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const customSound = push.diagnose().customSound

  useEffect(() => {
    let alive = true
    loadAppSettings().then((s) => alive && setSound(s.docSound || DEFAULT_DOC_SOUND))
    return () => { alive = false }
  }, [])

  async function change(id) {
    if (id === sound) return
    setSound(id)
    setBusy(true)
    setNote('')
    try {
      await saveAppSettings({ docSound: id })
      await rescheduleAllExpiryReminders(id)
      setNote('✅ تم حفظ صوت التنبيه لكل الوثائق.')
    } catch (err) {
      console.error(err)
      setNote('تعذّر الحفظ — حاول مرة أخرى.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-3xl border border-stone-900/10 bg-white p-5">
      <h4 className="font-display flex items-center gap-2 text-lg font-bold text-stone-900">
        <Volume2 size={20} className="text-stone-400" /> صوت تنبيه انتهاء الوثائق
        {busy && <Loader2 size={18} className="animate-spin text-primary" />}
      </h4>
      <p className="mb-3 mt-1 text-sm text-stone-500">اختر الصوت واضغط ▶ للاستماع إليه.</p>
      {sound ? (
        <SoundPicker value={sound} onChange={change} disabled={busy} />
      ) : (
        <div className="flex justify-center py-6 text-stone-400"><Loader2 className="animate-spin" /></div>
      )}
      {note && <p className="mt-3 text-sm font-bold text-primary">{note}</p>}
      <p className="mt-3 text-xs leading-relaxed text-stone-400">
        {customSound
          ? 'يرن الإشعار بالصوت المختار حتى والتطبيق مغلق (ما لم يكن الهاتف على الصامت).'
          : 'عندما يكون التطبيق مفتوحاً يُسمع الصوت المختار. وهو مغلق يرن الإشعار بنغمة الهاتف العادية — والصوت المختار يعمل مع التطبيق المغلق في نسخة المتجر فقط.'}
      </p>
    </section>
  )
}

export default function SettingsSheet({ open, onClose }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center md:items-center"
      style={{ height: 'var(--visual-height, 100dvh)' }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/45" />
      <div
        className="relative w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[rgb(var(--color-bg))] p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] shadow-2xl md:rounded-3xl md:pb-5"
        style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 2rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-2xl font-extrabold text-stone-900">الإعدادات</h3>
          <button onClick={onClose} title="إغلاق" className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-stone-900/10 bg-white text-stone-600 transition active:scale-95 hover:bg-stone-50">
            <X size={20} />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <LockSection />
          <DocSoundSection />
        </div>
      </div>
    </div>
  )
}