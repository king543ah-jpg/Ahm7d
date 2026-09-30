import { supabase } from './supabase'

export const auth = {
  // إنشاء حساب جديد بالإيميل وكلمة المرور
  signUp: async (email, password, name = '') => {
    const cleanEmail = email ? email.trim() : ''
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { full_name: name }
      }
    })
    if (error) throw error
    return data
  },

  // تسجيل الدخول بالإيميل وكلمة المرور
  signIn: async (email, password) => {
    const cleanEmail = email ? email.trim() : ''
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })
    if (error) throw error
    return data
  },

  // تسجيل الدخول عبر Google
  signInWithGoogle: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) throw error
    return data
  },

  // تسجيل الدخول عبر Apple
  signInWithApple: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin }
    })
    if (error) throw error
    return data
  },

  // تسجيل الخروج وتنظيف الذاكرة المحلية
  signOut: async () => {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn('Sign out warning:', e)
    }
    localStorage.clear()
    window.dispatchEvent(new Event('storage'))
    window.dispatchEvent(new Event('db_updated'))
    return true
  },

  // جلب بيانات المستخدم الحالي غير المزامنة (Async)
  getUser: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      return user
    } catch (e) {
      return null
    }
  },

  // جلب سريع للمستخدم من الجلسة المخزنة محلياً (Sync)
  getCurrentUser: () => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          const session = JSON.parse(localStorage.getItem(key) || '{}')
          if (session?.user) return session.user
        }
      }
    } catch (e) {}
    return null
  },

  // الاستماع لتغير حالة الحساب (تسجيل دخول/خروج)
  onAuthStateChange: (callback) => {
    return supabase.auth.onAuthStateChange((event, session) => {
      if (typeof callback === 'function') {
        callback(event, session)
      }
    })
  }
}

export default auth