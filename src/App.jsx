import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Folders from './pages/Folders'
import FolderDocs from './pages/FolderDocs'
import DocForm from './pages/DocForm'
import DocDetails from './pages/DocDetails'
import Prayer from './pages/Prayer'
import Search from './pages/Search'
import { loadPrayerSettings, refreshLocationIfMoved, syncPrayerReminders } from './hooks/prayerSync'
import { applyTheme, getTheme } from './hooks/theme'
import AppLockGate from './components/AppLockGate'
import ForegroundAlerts from './components/ForegroundAlerts'
import auth from './lib/auth'

applyTheme(getTheme())

function PrayerSync() {
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await loadPrayerSettings()
        if (cancelled || !s || !s.enabled || s.lat == null) return
        const updated = await refreshLocationIfMoved(s)
        if (cancelled) return
        if (updated === s) await syncPrayerReminders({ settings: s })
      } catch (err) {
        console.warn('[prayer] sync skipped:', err)
      }
    })()
    return () => { cancelled = true }
  }, [])
  return null
}

try {
  document.documentElement.setAttribute('dir', 'rtl')
  document.documentElement.setAttribute('lang', 'ar')
} catch {}

// شاشة تسجيل الدخول المدمجة
function LoginView() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleEmailAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    try {
      if (isSignUp) {
        await auth.signUp(email, password)
        alert('تم إنشاء الحساب بنجاح! إذا كان تفعيل البريد مفعلاً في Supabase فراجع بريدك الإلكتروني.')
      } else {
        await auth.signIn(email, password)
      }
    } catch (err) {
      setErrorMsg(err.message || 'حدث خطأ أثناء تسجيل الدخول')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-900 text-white p-4" dir="rtl">
      <div className="max-w-md w-full bg-stone-800 p-6 rounded-2xl shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">
            {isSignUp ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
          </h2>
          <p className="text-stone-400 text-sm">
            سجل دخولك لتتمكن من إنشاء المجلدات ومزامنة مستنداتك وخلفياتك بين جميع أجهزتك.
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-300 p-3 rounded-xl text-sm text-center">
            {errorMsg}
          </div>
        )}

        {/* أزرار التسجيل السريع */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => auth.signInWithGoogle()}
            className="w-full flex items-center justify-center gap-2 bg-white text-stone-900 font-semibold py-2.5 rounded-xl hover:bg-stone-100 transition"
          >
            المتابعة باستخدام Google
          </button>

          <button
            type="button"
            onClick={() => auth.signInWithApple()}
            className="w-full flex items-center justify-center gap-2 bg-stone-700 text-white font-semibold py-2.5 rounded-xl hover:bg-stone-600 transition"
          >
            المتابعة باستخدام Apple / iCloud
          </button>
        </div>

        <div className="flex items-center my-4">
          <div className="flex-1 border-t border-stone-700"></div>
          <span className="px-3 text-stone-500 text-xs">أو بالبريد الإلكتروني</span>
          <div className="flex-1 border-t border-stone-700"></div>
        </div>

        {/* نموذج البريد الإلكتروني */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <input
            type="email"
            placeholder="البريد الإلكتروني"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-stone-900 border border-stone-700 rounded-xl focus:outline-none focus:border-amber-500 text-sm text-white"
          />
          <input
            type="password"
            placeholder="كلمة المرور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-stone-900 border border-stone-700 rounded-xl focus:outline-none focus:border-amber-500 text-sm text-white"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-500 font-semibold py-2.5 rounded-xl transition text-sm text-white"
          >
            {loading ? 'جاري التحميل...' : isSignUp ? 'إنشاء حساب' : 'تسجيل الدخول'}
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-stone-400 hover:text-amber-400 text-xs underline"
          >
            {isSignUp ? 'لديك حساب بالفعل؟ سجل دخولك' : 'ليس لديك حساب؟ أنشئ حساباً جديداً'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // جلب المستخدم الحالي
    auth.getUser().then((u) => {
      setUser(u)
      setLoading(false)
    })

    // الاستماع للتغيرات الجارية (تسجيل/خروج)
    const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription?.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-stone-900 text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-amber-500"></div>
      </div>
    )
  }

  // إجبار التسجيل قبل الدخول للتطبيق
  if (!user) {
    return <LoginView />
  }

  return (
    <div dir="rtl" className="h-full">
      <PrayerSync />
      <ForegroundAlerts />
      {/* تمرير المعرف الحقيقي للمستخدم للمزامنة */}
      <AppLockGate userId={user.id}>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Folders />} />
            <Route path="/prayer" element={<Prayer />} />
            <Route path="/search" element={<Search />} />
            
            {/* إنشاء وثيقة جديدة */}
            <Route path="/doc/new" element={<DocForm />} />
            <Route path="/folder/:folderId/new" element={<DocForm />} />

            {/* تفاصيل وتعديل وثيقة */}
            <Route path="/doc/:docId/edit" element={<DocForm />} />
            <Route path="/doc/:docId" element={<DocDetails />} />

            {/* المجلدات والوثائق */}
            <Route path="/folder/:folderId" element={<FolderDocs />} />
            <Route path="/folder/:folderId/doc/:docId/edit" element={<DocForm />} />
            <Route path="/folder/:folderId/doc/:docId" element={<DocDetails />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </AppLockGate>
    </div>
  )
}