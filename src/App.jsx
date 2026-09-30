import { useEffect } from 'react'
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

export default function App() {
  const localUserId = 'local-device-user'

  return (
    <div dir="rtl" className="h-full">
      <PrayerSync />
      <ForegroundAlerts />
      <AppLockGate userId={localUserId}>
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