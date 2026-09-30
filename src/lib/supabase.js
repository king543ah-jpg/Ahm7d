import { createClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL || ''
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const supabaseUrl = rawUrl.trim().replace(/\/+$/, '')
const supabaseAnonKey = rawKey.trim()

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] تنبيه: متغيرات البيئة VITE_SUPABASE_URL أو VITE_SUPABASE_ANON_KEY غير معرفة بشكل صحيح!')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)