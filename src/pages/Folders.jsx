import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FolderPlus, Trash2, Bell, ChevronLeft, X, MoonStar, Sun, Moon, Settings, Search as SearchIcon, SlidersHorizontal, Folder as FolderIcon, Loader2 } from 'lucide-react'
import { cancelDocReminders } from '../hooks/reminders'
import SettingsSheet from '../components/SettingsSheet'
import AuthModal from '../components/AuthModal'
import { db } from '../lib/db'
import { useLive } from '../lib/useLive'
import { auth } from '../lib/auth'
import { push } from '../lib/push'
import ConfirmDialog from '../components/ConfirmDialog'
import { useTheme } from '../hooks/theme'

export default function Folders() {
  const liveFolders = useLive('folders')
  const rawFolders = Array.isArray(liveFolders) ? liveFolders : (liveFolders?.data || [])
  const loadingFolders = liveFolders?.loading ?? false

  const liveDocs = useLive('documents')
  const altDocs = useLive('docs')
  
  const docsList = (Array.isArray(liveDocs) ? liveDocs : liveDocs?.data) || []
  const altList = (Array.isArray(altDocs) ? altDocs : altDocs?.data) || []
  const docs = docsList.length >= altList.length ? docsList : altList

  const [user, setUser] = useState(() => auth.getCurrentUser())
  const [showAuth, setShowAuth] = useState(false)

  const [theme, toggleTheme] = useTheme()

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [notice, setNotice] = useState(null)
  const [showIosGuide, setShowIosGuide] = useState(false)
  const [bellBusy, setBellBusy] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // إعادة المزامنة وتحديث البيانات فور تغيير الحساب أو الدخول
  useEffect(() => {
    const { data: listener } = auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || auth.getCurrentUser())
      window.dispatchEvent(new Event('db_updated'))
    })
    return () => {
      listener?.subscription?.unsubscribe()
    }
  }, [])

  const countFor = (folderId) => {
    if (!folderId) return 0
    const safeFolderId = String(folderId)
    return (docs || []).filter((d) => String(d.folderId || d.folder_id) === safeFolderId).length
  }

  const getFolderName = (f) => {
    if (!f) return 'مجلد جديد'
    if (typeof f === 'string') return f
    return f.name || f.title || f.label || f.folderName || 'مجلد بدون عنوان'
  }

  async function createFolder() {
    const name = newName.trim()
    if (!name) {
      setCreateError('يرجى إدخال اسم المجلد')
      return
    }
    setCreating(true)
    setCreateError('')
    try {
      const generatedId = 'f_' + Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7)
      
      const folderPayload = {
        id: generatedId,
        _id: generatedId,
        name: name,
        title: name,
        label: name,
        createdAt: new Date().toISOString()
      }

      await db.insert('folders', folderPayload)
      window.dispatchEvent(new Event('db_updated'))

      setNewName('')
      setShowCreate(false)
    } catch (err) {
      setCreateError('تعذّر إنشاء المجلد — حاول مرة أخرى')
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const targetId = String(deleteTarget.id || deleteTarget._id)
      const inner = (docs || []).filter((d) => String(d.folderId || d.folder_id) === targetId)
      
      for (const doc of inner) {
        if (typeof cancelDocReminders === 'function') {
          await cancelDocReminders(doc)
        }
        await db.delete('documents', doc.id || doc._id)
        await db.delete('docs', doc.id || doc._id).catch(() => {})
      }

      await db.delete('folders', targetId)
      window.dispatchEvent(new Event('db_updated'))
      setDeleteTarget(null)
    } catch (err) {
      console.error(err)
    } finally {
      setDeleting(false)
    }
  }

  async function enableNotifications() {
    setBellBusy(true)
    setNotice(null)
    try {
      const d = push.diagnose()
      if (!d.supported) {
        setNotice({ kind: 'warn', text: 'هذا المتصفح لا يدعم التنبيهات.' })
        return
      }
      if (d.embedded) {
        setNotice({ kind: 'warn', text: 'التنبيهات تعمل في التطبيق المنشور فقط — افتح التطبيق من رابطه الرسمي ثم ثبّته على الشاشة الرئيسية.' })
        return
      }
      if (!push.isInstalled() && push.isIOS()) {
        setShowIosGuide(true)
        return
      }
      if (!push.isInstalled() && push.canInstall()) {
        const outcome = await push.promptInstall()
        if (outcome !== 'accepted') {
          setNotice({ kind: 'warn', text: 'يفضَّل تثبيت التطبيق على الشاشة الرئيسية لضمان وصول التنبيهات.' })
        }
      }
      const perm = await push.requestPermission()
      if (perm !== 'granted') {
        setNotice({ kind: 'warn', text: 'تم حظر التنبيهات — يمكنك تفعيلها من إعدادات المتصفح.' })
        return
      }
      await push.subscribe()
      setNotice({ kind: 'ok', text: '✅ تم تفعيل التنبيهات! ستصلك رسالة قبل 3 أيام من انتهاء أي وثيقة.' })
    } catch (err) {
      console.error(err)
      setNotice({ kind: 'warn', text: 'تعذّر تفعيل التنبيهات — حاول مرة أخرى.' })
    } finally {
      setBellBusy(false)
    }
  }

  const userInitial = user
    ? (user?.user_metadata?.full_name?.[0] || user?.displayName?.[0] || user?.email?.[0] || 'U').toUpperCase()
    : '؟'

  return (
    <div className="h-full overflow-y-auto paper-bg">
      <header className="sticky top-0 z-20 border-b border-stone-900/10 bg-[#f6f2e9]/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-md sm:flex">
              <FolderIcon size={22} />
            </div>
            <div>
              <h1 className="font-display text-xl font-extrabold leading-tight text-stone-900 md:text-2xl">مستنداتي</h1>
              <p className="hidden text-xs text-stone-500 sm:block">نظّم وثائقك وتابع تواريخ انتهائها</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <button
              onClick={() => setShowSettings(true)}
              title="الإعدادات: القفل والأصوات"
              aria-label="الإعدادات"
              className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-stone-900/10 bg-white text-stone-700 transition active:scale-95 hover:bg-stone-50"
            >
              <Settings size={20} />
            </button>
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'المظهر الفاتح' : 'المظهر الداكن'}
              aria-label={theme === 'dark' ? 'تفعيل المظهر الفاتح' : 'تفعيل المظهر الداكن'}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-stone-900/10 bg-white text-stone-700 transition active:scale-95 hover:bg-stone-50"
            >
              {theme === 'dark' ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} />}
            </button>
            <button
              onClick={enableNotifications}
              disabled={bellBusy}
              title="تفعيل التنبيهات"
              className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-secondary/40 bg-secondary/10 text-secondary transition active:scale-95 hover:bg-secondary/20 disabled:opacity-50"
            >
              <Bell size={20} />
            </button>
            
            <button
              onClick={() => setShowAuth(true)}
              title={user ? 'حسابي' : 'تسجيل الدخول'}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-stone-900/10 bg-white text-stone-700 transition active:scale-95 hover:bg-stone-50"
            >
              <span className="font-display text-base font-bold">
                {userInitial}
              </span>
            </button>
          </div>
        </div>
        {notice && (
          <div className="mx-auto max-w-4xl px-4 pb-3 md:px-8">
            <div
              className={`flex items-start justify-between gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                notice.kind === 'ok'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              <span>{notice.text}</span>
              <button onClick={() => setNotice(null)} className="shrink-0 opacity-60">
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-5 md:px-8">
        <Link
          to="/search"
          className="mb-3 flex min-h-[56px] w-full items-center gap-3 rounded-3xl border-2 border-stone-200 bg-white px-5 text-stone-400 shadow-sm transition active:scale-[0.98] hover:border-primary/40"
        >
          <SearchIcon size={22} className="shrink-0 text-primary" />
          <span className="flex-1 truncate text-lg font-semibold">ابحث في كل وثائقك…</span>
          <SlidersHorizontal size={20} className="shrink-0" />
        </Link>

        <button
          onClick={() => setShowCreate(true)}
          className="flex min-h-[60px] w-full items-center justify-center gap-3 rounded-3xl bg-primary px-6 text-xl font-bold text-white shadow-lg shadow-primary/25 transition active:scale-[0.98] hover:opacity-90"
        >
          <FolderPlus size={26} />
          إنشاء مجلد جديد
        </button>

        <Link
          to="/prayer"
          className="mt-3 flex min-h-[60px] w-full items-center justify-between gap-3 rounded-3xl border-2 border-primary/20 bg-white px-5 text-primary shadow-sm transition active:scale-[0.98] hover:bg-primary/5"
        >
          <span className="flex items-center gap-3">
            <MoonStar size={24} />
            <span className="font-display text-lg font-bold">مواقيت الصلاة وتنبيه الأذان</span>
          </span>
          <ChevronLeft size={22} className="text-primary/50" />
        </Link>

        {loadingFolders ? (
          <div className="mt-14 flex flex-col items-center justify-center text-stone-500 gap-3">
            <Loader2 className="animate-spin text-primary" size={32} />
            <p className="text-sm font-semibold">جارٍ جلب المجلدات من السحابة…</p>
          </div>
        ) : !rawFolders || rawFolders.length === 0 ? (
          <div className="mt-14 flex flex-col items-center text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
              <FolderIcon size={44} className="text-primary" />
            </div>
            <h2 className="font-display mt-5 text-2xl font-bold text-stone-800">لا توجد مجلدات بعد</h2>
            <p className="mt-2 max-w-xs text-base leading-relaxed text-stone-500">
              ابدأ بإنشاء أول مجلد لتنظيم وثائقك، مثل «الأوراق الرسمية» أو «الشهادات».
            </p>
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {rawFolders.map((f, i) => {
              const folderId = String(f.id || f._id)
              const folderTitle = getFolderName(f)
              return (
                <li
                  key={folderId}
                  className="animate-[fadeUp_.4s_ease_both]"
                  style={{ animationDelay: `${Math.min(i * 60, 300)}ms` }}
                >
                  <div className="group relative flex items-stretch overflow-hidden rounded-3xl border border-stone-900/10 bg-white shadow-sm transition hover:shadow-md">
                    <span className="absolute inset-y-0 right-0 w-1.5 bg-primary/70" />
                    <Link
                      to={`/folder/${folderId}`}
                      className="flex min-h-[84px] flex-1 items-center gap-4 px-5 py-4"
                    >
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <FolderIcon size={28} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display truncate text-lg font-bold text-stone-900 md:text-xl">
                          {folderTitle}
                        </h3>
                        <p className="mt-1 text-sm font-semibold text-stone-500">
                          {countFor(folderId)} وثيقة
                        </p>
                      </div>
                      <ChevronLeft size={22} className="shrink-0 text-stone-300 transition group-hover:text-primary" />
                    </Link>
                    <button
                      onClick={() => setDeleteTarget(f)}
                      title="حذف المجلد"
                      className="flex w-14 shrink-0 items-center justify-center border-r border-stone-100 text-stone-300 transition hover:bg-red-50 hover:text-red-600 active:scale-90"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      {showCreate && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center md:items-center"
          style={{ height: 'var(--visual-height, 100dvh)' }}
          onClick={() => setShowCreate(false)}
        >
          <div className="absolute inset-0 bg-black/45" />
          <div
            className="relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl md:rounded-3xl"
            style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 2rem)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl font-bold text-stone-900">مجلد جديد</h3>
            <label className="mt-4 block text-sm font-semibold text-stone-600">اسم المجلد</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setCreateError('') }}
              onKeyDown={(e) => e.key === 'Enter' && createFolder()}
              placeholder="مثال: الأوراق الرسمية"
              className="mt-2 min-h-[54px] w-full rounded-2xl border-2 border-stone-200 bg-stone-50 px-4 text-lg font-semibold text-stone-900 outline-none transition focus:border-primary focus:bg-white"
            />
            {createError && <p className="mt-2 text-sm font-semibold text-red-600">{createError}</p>}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="min-h-[52px] flex-1 rounded-2xl border-2 border-stone-200 text-lg font-bold text-stone-600 transition active:scale-95 hover:bg-stone-50"
              >
                إلغاء
              </button>
              <button
                onClick={createFolder}
                disabled={creating}
                className="min-h-[52px] flex-1 rounded-2xl bg-primary text-lg font-bold text-white transition active:scale-95 disabled:opacity-60"
              >
                {creating ? 'جارٍ الإنشاء…' : 'إنشاء'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showIosGuide && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center md:items-center"
          style={{ height: 'var(--visual-height, 100dvh)' }}
          onClick={() => setShowIosGuide(false)}
        >
          <div className="absolute inset-0 bg-black/45" />
          <div
            className="relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl md:rounded-3xl"
            style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 2rem)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl font-bold text-stone-900">ثبّت التطبيق أولاً 🔔</h3>
            <ol className="mt-4 list-inside list-decimal space-y-3 text-base leading-relaxed text-stone-700">
              <li>إن كنت تفتح التطبيق داخل نافذة المعاينة، انسخ رابط التطبيق وافتحه في متصفح Safari أولاً.</li>
              <li>اضغط زر «مشاركة» في Safari (المربع مع السهم ⬆️).</li>
              <li>اختر «إضافة إلى الشاشة الرئيسية» ثم «إضافة».</li>
              <li>افتح التطبيق من أيقونته الجديدة، ثم اضغط جرس التنبيهات مرة أخرى.</li>
            </ol>
            <button
              onClick={() => setShowIosGuide(false)}
              className="mt-6 min-h-[52px] w-full rounded-2xl bg-primary text-lg font-bold text-white transition active:scale-95"
            >
              فهمت
            </button>
          </div>
        </div>
      )}

      <SettingsSheet open={showSettings} onClose={() => setShowSettings(false)} />

      <AuthModal
        open={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={() => {
          setUser(auth.getCurrentUser())
          window.dispatchEvent(new Event('db_updated'))
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف المجلد؟"
        message={deleteTarget ? `سيتم حذف المجلد «${getFolderName(deleteTarget)}» وجميع الوثائق بداخله (${countFor(deleteTarget.id || deleteTarget._id)} وثيقة). لا يمكن التراجع عن هذه الخطوة.` : ''}
        confirmLabel="حذف"
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />

      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}