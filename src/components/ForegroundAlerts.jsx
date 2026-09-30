import { useEffect, useState } from 'react'
import { BellRing, VolumeX, X } from 'lucide-react'
import { push } from '../lib/push'
import { loadPrayerSettings } from '../hooks/prayerSync'
import { DEFAULT_PRAYER_SOUND, getDocSound, playSound, stopSound } from '../hooks/sounds'

/**
 * While the app is OPEN, a reminder that arrives also plays its chosen sound
 * in-app and shows a banner (the phone's own notification tone covers the
 * app-closed case).
 */
export default function ForegroundAlerts() {
  const [alert, setAlert] = useState(null) // { title, body }

  useEffect(() => {
    const unsub = push.onNotification(async (n) => {
      const title = n?.title || ''
      const body = n?.body || ''
      const url = n?.data?.url || n?.url || ''
      setAlert({ title, body })
      // The store app already rings with the chosen sound — avoid a double ring.
      if (push.diagnose().native) return
      try {
        const isPrayer = url.includes('prayer') || title.includes('🕌')
        const sound = isPrayer
          ? ((await loadPrayerSettings())?.sound || DEFAULT_PRAYER_SOUND)
          : await getDocSound()
        await playSound(sound, { maxSec: 60 })
      } catch (err) {
        console.warn('[alerts] sound failed:', err)
      }
    })
    return () => { unsub?.(); stopSound() }
  }, [])

  if (!alert) return null

  function close() {
    stopSound()
    setAlert(null)
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <div className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-3xl bg-primary p-4 text-white shadow-2xl shadow-black/30 animate-[alertIn_.35s_ease_both]">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
          <BellRing size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-extrabold leading-snug">{alert.title}</p>
          {alert.body && <p className="mt-0.5 text-sm font-semibold text-white/80">{alert.body}</p>}
          <button
            onClick={stopSound}
            className="mt-2 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-bold transition hover:bg-white/25 active:scale-95"
          >
            <VolumeX size={16} /> إيقاف الصوت
          </button>
        </div>
        <button onClick={close} title="إغلاق" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/70 hover:bg-white/10">
          <X size={20} />
        </button>
      </div>
      <style>{`@keyframes alertIn { from { opacity: 0; transform: translateY(-16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}