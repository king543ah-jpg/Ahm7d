import { useEffect, useRef, useState } from 'react'
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { auth } from '../lib/auth'
import { useLockConfig, verifyLockPassword, clearLock, RELOCK_AFTER_MS } from '../hooks/appLock'
import ConfirmDialog from './ConfirmDialog'

const MAX_TRIES = 5
const COOLDOWN_SEC = 30

function LockScreen({ onUnlock }) {
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [tries, setTries] = useState(0)
  const [waitUntil, setWaitUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [forgot, setForgot] = useState(false)
  const inputRef = useRef(null)

  const waiting = waitUntil > now
  useEffect(() => {
    if (!waiting) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [waiting])

  async function submit(e) {
    e?.preventDefault()
    if (!pw || busy || waiting) return
    setBusy(true)
    const ok = await verifyLockPassword(pw).catch(() => false)
    setBusy(false)
    if (ok) {
      onUnlock()
      return
    }
    const n = tries + 1
    setTries(n)
    setPw('')
    setShake(true)
    setTimeout(() => setShake(false), 450)
    if (n >= MAX_TRIES) {
      setWaitUntil(Date.now() + COOLDOWN_SEC * 1000)
      setNow(Date.now())
      setTries(0)
      setError(`محاولات كثيرة خاطئة — انتظر ${COOLDOWN_SEC} ثانية ثم حاول مجدداً.`)
    } else {
      setError(`كلمة السر غير صحيحة (متبقٍ ${MAX_TRIES - n} محاولات)`)
    }
    inputRef.current?.focus()
  }

  function resetViaAccount() {
    clearLock()
    auth.signOut()
  }

  const secsLeft = Math.max(0, Math.ceil((waitUntil - now) / 1000))

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex flex-col overflow-y-auto paper-bg bg-[rgb(var(--color-bg))] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom,0px)]">
      <form onSubmit={submit} className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="relative">
          <div className="absolute inset-0 rounded-[2rem] bg-primary/25 blur-xl" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] bg-primary text-white shadow-xl">
            <Lock size={42} />
          </div>
        </div>
        <h1 className="font-display mt-6 text-3xl font-black text-stone-900">التطبيق مقفول</h1>
        <p className="mt-2 text-center text-base font-semibold text-stone-500">أدخل كلمة السر لفتح مستنداتك</p>

        <div className={`relative mt-7 w-full ${shake ? 'animate-[lockShake_.4s_ease]' : ''}`}>
          <input
            ref={inputRef}
            autoFocus
            type={show ? 'text' : 'password'}
            value={pw}
            onChange={(e) => { setPw(e.target.value); setError('') }}
            disabled={waiting}
            autoComplete="current-password"
            placeholder="كلمة السر"
            className="min-h-[60px] w-full rounded-2xl border-2 border-stone-200 bg-white px-5 pl-14 text-center text-2xl font-bold tracking-widest text-stone-900 outline-none transition focus:border-primary disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            title={show ? 'إخفاء' : 'إظهار'}
            className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-stone-400 hover:text-stone-600"
          >
            {show ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        {error && <p className="mt-3 text-center text-sm font-bold text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={!pw || busy || waiting}
          className="mt-5 flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-xl font-bold text-white shadow-lg shadow-primary/25 transition active:scale-[0.98] hover:opacity-90 disabled:opacity-50"
        >
          {busy && <Loader2 className="animate-spin" size={22} />}
          {waiting ? `انتظر ${secsLeft} ث` : 'فتح'}
        </button>

        <button
          type="button"
          onClick={() => setForgot(true)}
          className="mt-5 min-h-[44px] px-4 text-base font-bold text-primary underline-offset-4 hover:underline"
        >
          نسيت كلمة السر؟
        </button>
      </form>

      <ConfirmDialog
        open={forgot}
        title="نسيت كلمة السر؟"
        message="سيتم تسجيل خروجك وإلغاء قفل التطبيق على هذا الجهاز. بعد تسجيل الدخول مرة أخرى بحسابك ستجد كل مستنداتك كما هي، ويمكنك تعيين كلمة سر جديدة."
        confirmLabel="تسجيل الخروج"
        onConfirm={resetViaAccount}
        onCancel={() => setForgot(false)}
      />

      <style>{`@keyframes lockShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-10px)} 40%{transform:translateX(10px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }`}</style>
    </div>
  )
}

/**
 * Covers the app with a lock screen on launch, and again after it has been
 * in the background for over a minute — only when the user enabled a lock.
 */
export default function AppLockGate({ userId, children }) {
  const cfg = useLockConfig(userId)
  const [locked, setLocked] = useState(() => !!cfg)
  const hiddenAt = useRef(0)

  useEffect(() => {
    function onVis() {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
      } else if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS) {
        setLocked(true)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  return (
    <>
      {children}
      {cfg && locked && <LockScreen onUnlock={() => setLocked(false)} />}
    </>
  )
}