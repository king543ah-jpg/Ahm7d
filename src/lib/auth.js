import { supabase } from './supabase'
import { db } from './db'

export const auth = {
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

    if (data?.session) {
      await db.syncAll().catch(() => {})
      window.dispatchEvent(new Event('db_updated'))
    }
    return data
  },

  signIn: async (email, password) => {
    const cleanEmail = email ? email.trim() : ''
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })
    if (error) throw error

    if (data?.session) {
      await db.syncAll().catch(() => {})
      window.dispatchEvent(new Event('db_updated'))
    }
    return data
  },

  signInWithGoogle: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) throw error
    return data
  },

  signInWithApple: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin }
    })
    if (error) throw error
    return data
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn('Sign out warning:', e)
    }

    localStorage.removeItem('db_folders')
    localStorage.removeItem('live_folders')
    localStorage.removeItem('db_documents')
    localStorage.removeItem('live_documents')
    localStorage.removeItem('db_docs')
    localStorage.removeItem('live_docs')

    window.dispatchEvent(new Event('storage'))
    window.dispatchEvent(new Event('db_updated'))
    return true
  },

  getUser: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      return user
    } catch (e) {
      return null
    }
  },

  getCurrentUser: () => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          const item = JSON.parse(localStorage.getItem(key) || '{}')
          if (item?.user) return item.user
          if (item?.currentSession?.user) return item.currentSession.user
        }
      }
    } catch (e) {}
    return null
  },

  onAuthStateChange: (callback) => {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await db.syncAll().catch(() => {})
        window.dispatchEvent(new Event('db_updated'))
      }
      if (typeof callback === 'function') {
        callback(event, session)
      }
    })
  }
}

export default auth