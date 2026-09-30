import { supabase } from './supabase'

export const storage = {
  // رفع صورة أو ملف (PDF/Word/الخ)
  upload: async (file, fileName) => {
    try {
      if (supabase && supabase.storage) {
        const ext = file.name ? file.name.split('.').pop() : 'bin'
        const cleanName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`
        const path = `uploads/${cleanName}`

        const { data, error } = await supabase.storage
          .from('doc-files')
          .upload(path, file, { cacheControl: '3600', upsert: true })

        if (!error && data) {
          const { data: pubData } = supabase.storage.from('doc-files').getPublicUrl(path)
          if (pubData?.publicUrl) {
            return { url: pubData.publicUrl, path }
          }
        }
      }
    } catch (err) {
      console.warn('تعذّر الرفع السحابي، جاري الحفظ المحلي الاحتياطي:', err)
    }

    // نظام احتياطي محلي في حال عدم إعداد السحابة
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve({ url: reader.result, path: '' })
      reader.onerror = (e) => reject(e)
      reader.readAsDataURL(file)
    })
  },

  // حذف ملف من السحابة
  delete: async (fileUrlOrPath) => {
    try {
      if (!fileUrlOrPath || !supabase || !supabase.storage) return
      const path = fileUrlOrPath.includes('doc-files/')
        ? fileUrlOrPath.split('doc-files/')[1]
        : fileUrlOrPath
      if (path && !path.startsWith('data:')) {
        await supabase.storage.from('doc-files').remove([path])
      }
    } catch (err) {
      console.warn('Storage delete warning:', err)
    }
  }
}

export default storage