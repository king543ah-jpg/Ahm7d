import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Plus, Trash2, FileText, ChevronLeft, Calendar, Image as ImageIcon, Paperclip } from 'lucide-react'
import { db } from '../lib/db'
import { useLive } from '../lib/useLive'
import ConfirmDialog from '../components/ConfirmDialog'
import StatusBadge from '../components/StatusBadge'
import { remainingText } from '../hooks/docStatus'
import { cancelDocReminders } from '../hooks/reminders'

export default function FolderDocs() {
  const { id, folderId: routeFolderId } = useParams()
  const currentFolderId = id || routeFolderId

  const navigate = useNavigate()

  const liveFolders = useLive('folders')
  const folders = Array.isArray(liveFolders) ? liveFolders : (liveFolders?.data || [])

  const liveDocs = useLive('documents', { order: '-createdAt' })
  const rawDocs = Array.isArray(liveDocs) ? liveDocs : (liveDocs?.data || [])

  const folder = (folders || []).find(
    (f) => String(f.id || f._id) === String(currentFolderId)
  )

  const targetFolderId = folder?.id || folder?._id || currentFolderId

  const folderDocs = (rawDocs || []).filter((doc) => {
    const docFId = String(doc.folderId || doc.folder_id || '')
    return docFId === String(targetFolderId)
  })

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const folderName = folder
    ? (folder.name || folder.title || folder.label || 'مجلد بدون عنوان')
    : 'المجلد'

  async function confirmDeleteFolder() {
    setDeleting(true)
    try {
      for (const doc of folderDocs) {
        if (typeof cancelDocReminders === 'function') {
          await cancelDocReminders(doc)
        }
        if (db && typeof db.delete === 'function') {
          await db.delete('documents', doc.id || doc._id)
        }
      }

      if (db && typeof db.delete === 'function') {
        await db.delete('folders', targetFolderId)
      }

      navigate('/')
    } catch (err) {
      console.error(err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto paper-bg">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-stone-900/10 bg-[#f6f2e9]/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-stone-900/10 bg-white text-stone-700 transition active:scale-95 hover:bg-stone-50"
            >
              <ArrowRight size={20} />
            </Link>
            <div>
              <p className="text-xs font-semibold text-stone-500">مجلد</p>
              <h1 className="font-display text-xl font-extrabold text-stone-900 md:text-2xl">
                {folderName}
              </h1>
            </div>
          </div>

          <button
            onClick={() => setDeleteTarget(true)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-red-200 bg-red-50 text-red-600 transition active:scale-95 hover:bg-red-100"
            title="حذف المجلد"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-5 md:px-8">
        <Link
          to={`/folder/${encodeURIComponent(targetFolderId)}/new`}
          className="flex min-h-[60px] w-full items-center justify-center gap-3 rounded-3xl bg-primary px-6 text-xl font-bold text-white shadow-lg shadow-primary/25 transition active:scale-[0.98] hover:opacity-90"
        >
          <Plus size={26} />
          إضافة وثيقة جديدة
        </Link>

        {folderDocs.length === 0 ? (
          <div className="mt-14 flex flex-col items-center text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-amber-100/60 text-amber-700">
              <FileText size={44} />
            </div>
            <h2 className="font-display mt-5 text-2xl font-bold text-stone-800">
              لا توجد وثائق في هذا المجلد
            </h2>
            <p className="mt-2 max-w-xs text-base leading-relaxed text-stone-500">
              أضف أول وثيقة مع تاريخ انتهائها، وسننبهك قبل اقتراب الموعد.
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {folderDocs.map((doc, i) => {
              const docId = doc.id || doc._id || `doc_${i}`
              const docTitle = doc.title || doc.name || 'وثيقة بدون عنوان'
              const fileCount = Array.isArray(doc.files) ? doc.files.length : 0

              return (
                <li key={docId}>
                  <Link
                    to={`/folder/${targetFolderId}/doc/${docId}`}
                    className="flex min-h-[84px] items-center justify-between gap-4 rounded-3xl border border-stone-900/10 bg-white p-4 shadow-sm transition hover:shadow-md active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-600">
                        <FileText size={24} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-display truncate text-lg font-bold text-stone-900">
                          {docTitle}
                        </h3>
                        
                        {/* الشارات المباشرة من الخارج */}
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <StatusBadge expiryDate={doc.expiryDate} />
                          {doc.expiryDate && (
                            <span className="text-xs font-bold text-stone-500 flex items-center gap-1">
                              <Calendar size={12} />
                              {remainingText(doc.expiryDate)}
                            </span>
                          )}
                          {doc.imageUrl && (
                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                              <ImageIcon size={10} /> صورة
                            </span>
                          )}
                          {fileCount > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">
                              <Paperclip size={10} /> {fileCount} ملفات
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronLeft size={20} className="shrink-0 text-stone-300" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      <ConfirmDialog
        open={!!deleteTarget}
        title="حذف المجلد بالكامل؟"
        message={`هل أنت تأكد من حذف المجلد «${folderName}» مع جميع الوثائق الموجودة داخله (${folderDocs.length} وثيقة)؟`}
        confirmLabel="حذف"
        danger
        busy={deleting}
        onConfirm={confirmDeleteFolder}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}