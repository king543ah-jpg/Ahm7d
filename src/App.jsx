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

// شاشة تسجيل الدخول المباشر بالبريد وكلمة المرور
function LoginView() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    try {
      if (isSignUp) {
        await auth.signUp(email, password)
        // محاولة تسجيل الدخول مباشرة بعد إنشاء الحساب
        try {
          await auth.signIn(email, password)
        } catch (e) {}
      } else {
        await auth.signIn(email, password)
      }
    } catch (err) {
      setErrorMsg(err.message || 'حدث خطأ، تأكد من صحة البريد وكلمة المرور')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-900 text-white p-4" dir="rtl">
      <div className="max-w-md w-full bg-stone-800 p-6 rounded-2xl shadow-xl space-y-6 border border-stone-700">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-amber-500">
            {isSignUp ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
          </h2>
          <p className="text-stone-400 text-sm">
            {isSignUp
              ? 'أنشئ حسابك لمزامنة مستنداتك ومجلداتك بين التليفون والكمبيوتر.'
              : 'سجل دخولك ببريدك وكلمة المرور للوصول إلى بياناتك من أي جهاز.'}
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-300 p-3 rounded-xl text-sm text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-stone-400 mb-1">البريد الإلكتروني</label>
            <input
              type="email"
              placeholder="example@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-stone-900 border border-stone-700 rounded-xl focus:outline-none focus:border-amber-500 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-stone-400 mb-1">كلمة المرور</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-stone-900 border border-stone-700 rounded-xl focus:outline-none focus:border-amber-500 text-sm text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-500 font-bold py-3 rounded-xl transition text-sm text-stone-950 mt-2"
          >
            {loading ? 'جاري التحميل...' : isSignUp ? 'إنشاء الحساب' : 'دخول'}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-stone-700">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setErrorMsg('')
            }}
            className="text-stone-300 hover:text-amber-400 text-xs font-semibold"
          >
            {isSignUp ? 'لديك حساب بالفعل؟ سجل دخولك من هنا' : 'ليس لديك حساب؟ اضغط هنا لإنشاء حساب جديد'}
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
    auth.getUser().then((u) => {
      setUser(u)
      setLoading(false)
    })

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

  if (!user) {
    return <LoginView />
  }

  return (
    <div dir="rtl" className="h-full">
      <PrayerSync />
      <ForegroundAlerts />
      <AppLockGate userId={user.id}>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Folders />} />
            <Route path="/prayer" element={<Prayer />} />
            <Route path="/search" element={<Search />} />
            
            <Route path="/doc/new" element={<DocForm />} />
            <Route path="/folder/:folderId/new" element={<DocForm />} />

            <Route path="/doc/:docId/edit" element={<DocForm />} />
            <Route path="/doc/:docId" element={<DocDetails />} />

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