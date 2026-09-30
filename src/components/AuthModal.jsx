import { useState } from 'react'
import { X, Mail, Lock, User, Loader2, LogIn, UserPlus } from 'lucide-react'
import { auth } from '../lib/auth'
import { db } from '../lib/db'

export default function AuthModal({ open, onClose, onSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError('يرجى كتابة البريد الإلكتروني وكلمة المرور')
      return
    }
    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (isSignUp) {
        await auth.signUp(email.trim(), password, name.trim())
      } else {
        await auth.signIn(email.trim(), password)
      }

      // جلب ومزامنة المجلدات والوثائق الخاصة بالحساب الجديد
      await db.select('folders')
      await db.select('documents')

      setEmail('')
      setPassword('')
      setName('')
      if (onSuccess) onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      if (err.message?.includes('Invalid login credentials')) {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
      } else if (err.message?.includes('already registered')) {
        setError('هذا البريد الإلكتروني مسجّل بالفعل — قم بتسجيل الدخول')
      } else {
        setError(err.message || 'حدث خطأ أثناء الاتصال — حاول مرة أخرى')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSocialLogin(provider) {
    setError('')
    try {
      if (provider === 'google') await auth.signInWithGoogle()
      if (provider === 'apple') await auth.signInWithApple()
    } catch (err) {
      console.error(err)
      setError('تعذّر تسجيل الدخول من خلال المزود — حاول مجدداً')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-500 transition hover:bg-stone-200"
        >
          <X size={20} />
        </button>

        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {isSignUp ? <UserPlus size={32} /> : <LogIn size={32} />}
          </div>
          <h2 className="font-display mt-4 text-2xl font-bold text-stone-900">
            {isSignUp ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
          </h2>
          <p className="mt-1 text-sm font-semibold text-stone-500">
            احفظ وثائقك في السحابة واسترجعها من أي هاتف
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl bg-red-50 p-3 text-center text-sm font-bold text-red-600 border border-red-100">
            {error}
          </div>
        )}

        {/* أزرار Google و Apple */}
        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={() => handleSocialLogin('google')}
            className="flex min-h-[50px] w-full items-center justify-center gap-3 rounded-2xl border-2 border-stone-200 bg-white text-base font-bold text-stone-700 transition active:scale-95 hover:bg-stone-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            متابعة بواسطة Google
          </button>

          <button
            type="button"
            onClick={() => handleSocialLogin('apple')}
            className="flex min-h-[50px] w-full items-center justify-center gap-3 rounded-2xl bg-black text-base font-bold text-white transition active:scale-95 hover:bg-stone-800"
          >
            <svg className="h-5 w-5 fill-current" viewBox="0 0 170 170">
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-5.01.12-9.87-1.96-14.58-6.23-3.23-2.83-7.14-7.53-11.73-14.1-6.19-8.8-11.19-18.89-14.99-30.26-3.8-11.38-5.71-22.18-5.71-32.4 0-14.4 3.65-26.15 10.96-35.25 7.31-9.1 16.51-13.72 27.61-13.85 4.88 0 10.22 1.25 16.03 3.75 5.8 2.5 9.77 3.75 11.9 3.75 1.88 0 5.92-1.3 12.13-3.9 6.21-2.6 11.35-3.8 15.42-3.6 11.51.9 20.65 5.25 27.42 13.05-10.27 6.22-15.3 15.02-15.08 26.4.22 8.89 3.59 16.32 10.11 22.29 6.53 5.97 14.34 9.27 23.43 9.9-1.2 5.09-2.88 10.37-5.04 15.84zm-30.82-108c0 6.6-2.45 13.05-7.35 19.35-4.9 6.3-10.95 10.2-18.15 11.7-1.12-8.1 1.4-15.52 7.56-22.26 6.16-6.74 13.11-10.74 20.85-12 0 1.07.09 2.14.09 3.21z" />
            </svg>
            متابعة بواسطة Apple
          </button>
        </div>

        <div className="relative my-4 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-200" /></div>
          <span className="relative bg-white px-3 text-xs font-bold text-stone-400">أو بالبريد الإلكتروني</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {isSignUp && (
            <div>
              <label className="block text-xs font-bold text-stone-600 mb-1">الاسم الكامل</label>
              <div className="relative flex items-center">
                <User size={18} className="absolute right-4 text-stone-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="أحمد محمد"
                  className="min-h-[50px] w-full rounded-2xl border-2 border-stone-200 bg-stone-50 pr-11 pl-4 text-base font-semibold text-stone-900 outline-none focus:border-primary focus:bg-white"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-600 mb-1">البريد الإلكتروني</label>
            <div className="relative flex items-center">
              <Mail size={18} className="absolute right-4 text-stone-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@mail.com"
                dir="ltr"
                className="min-h-[50px] w-full rounded-2xl border-2 border-stone-200 bg-stone-50 pr-11 pl-4 text-base font-semibold text-stone-900 outline-none focus:border-primary focus:bg-white text-left"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-600 mb-1">كلمة المرور</label>
            <div className="relative flex items-center">
              <Lock size={18} className="absolute right-4 text-stone-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                className="min-h-[50px] w-full rounded-2xl border-2 border-stone-200 bg-stone-50 pr-11 pl-4 text-base font-semibold text-stone-900 outline-none focus:border-primary focus:bg-white text-left"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-white shadow-lg shadow-primary/25 transition active:scale-95 disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={22} /> : isSignUp ? 'إنشاء الحساب' : 'تسجيل الدخول'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError('')
            }}
            className="text-sm font-bold text-primary hover:underline"
          >
            {isSignUp ? 'لديك حساب بالفعل؟ سجل الدخول' : 'ليس لديك حساب؟ أنشئ حساباً جديداً'}
          </button>
        </div>
      </div>
    </div>
  )
}