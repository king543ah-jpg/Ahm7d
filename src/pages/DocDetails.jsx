import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Pencil, Trash2, CalendarDays, FileText, Loader2, ExternalLink, Download, Paperclip, BellRing, Link2, Globe } from 'lucide-react'
import { hostOf, normalizeUrl } from '../components/LinksEditor'
import { download } from '../lib/download'
import { formatSize, fileExt } from '../hooks/fileInfo'
import { db } from '../lib/db'
import { useLive } from '../lib/useLive'
import { formatArDate, remainingText, statusOf, STATUS_META } from '../hooks/docStatus'
import { cancelDocReminders, customReminderFireAt, describeReminder } from '../hooks/reminders'
import StatusBadge from '../components/StatusBadge'
import ConfirmDialog from '../components/ConfirmDialog'

export default function DocDetails() {
  const { folderId: routeFolderId, docId } = useParams()
  const navigate = useNavigate()
  
  const { data: docs, loading } = useLive('documents')
  const doc = (docs || []).find((d) => String(d.id || d._id) === String(docId))

  const docFolderId = doc?.folderId || doc?.folder_id || routeFolderId
  const actualFolderId = (docFolderId && !docFolderId.startsWith('folder_')) ? docFolderId : routeFolderId

  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const [savingFile, setSavingFile] = useState(null)

  async function saveFile(f) {
    setSavingFile(f.url)
    try {
      await download.saveFile(f.url, f.name || 'file')
    } catch (err) {
      console.error(err)
    } finally {
      setSavingFile(null)
    }
  }

  async function confirmDelete() {
    if (!doc) return
    setDeleting(true)
    try {
      await cancelDocReminders(doc)
      await db.delete('documents', doc.id || doc._id)
      navigate(`/folder/${actualFolderId}`, { replace: true })
    } catch (err) {
      console.error(err)
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center paper-bg text-stone-500">
        <Loader2 className="animate-spin" size={28} />
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 paper-bg px-6 text-center">
        <FileText size={44} className="text-stone-300" />
        <p className="text-lg font-bold text-stone-600">لم يتم العثور على هذه الوثيقة</p>
        <Link
          to={actualFolderId && !actualFolderId.startsWith('folder_') ? `/folder/${actualFolderId}` : '/'}
          className="min-h-[50px] rounded-2xl bg-primary px-6 text-lg font-bold leading-[50px] text-white"
        >
          عودة للمجلد
        </Link>
      </div>
    )
  }

  const expiry = doc.expiryDate || doc.expiry_date
  const status = statusOf(expiry)
  const meta = STATUS_META[status]
  const customFields = Array.isArray(doc.customFields) ? doc.customFields.filter((f) => f.label || f.value) : (doc.custom_fields || [])
  const files = Array.isArray(doc.files) ? doc.files.filter((f) => f && f.url) : []
  const reminders = Array.isArray(doc.reminders) ? doc.reminders : []
  const links = Array.isArray(doc.links) ? doc.links.filter((l) => l && l.url) : []
  const displayImage = doc.imageUrl || doc.image_url
  const now = new Date()

  return (
    <div className="h-full overflow-y-auto paper-bg">
      <header className="sticky top-0 z-20 border-b border-stone-900/10 bg-[#f6f2e9]/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 md:px-8">
          <Link
            to={`/folder/${actualFolderId}`}
            title="عودة"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-stone-900/10 bg-white text-stone-700 transition active:scale-95 hover:bg-stone-50"
          >
            <ArrowRight size={22} />
          </Link>
          <h1 className="font-display min-w-0 flex-1 truncate text-xl font-extrabold text-stone-900 md:text-2xl">
            تفاصيل الوثيقة
          </h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-5 md:px-8">
        <section className="overflow-hidden rounded-3xl border border-stone-900/10 bg-white shadow-sm">
          <span className={`block h-2 ${meta.bar}`} />
          <div className="p-5">
            <h2 className="font-display text-2xl font-extrabold leading-snug text-stone-900 md:text-3xl">
              {doc.name || doc.title || 'وثيقة بدون عنوان'}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <StatusBadge expiryDate={expiry} />
              <span className="text-base font-bold text-stone-600">{remainingText(expiry)}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-stone-50 px-4 py-3">
              <CalendarDays size={20} className="shrink-0 text-primary" />
              <div>
                <p className="text-xs font-bold text-stone-500">تاريخ الانتهاء</p>
                <p className="text-lg font-extrabold text-stone-900">
                  {expiry ? formatArDate(expiry) : 'لم يُحدد'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {customFields.length > 0 && (
          <section className="mt-4 rounded-3xl border border-stone-900/10 bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-stone-800">معلومات إضافية</h3>
            <ul className="mt-3 flex flex-col divide-y divide-stone-100">
              {customFields.map((f, i) => (
                <li key={i} className="flex items-baseline justify-between gap-4 py-3">
                  <span className="shrink-0 text-sm font-bold text-stone-500">{f.label || '—'}</span>
                  <span className="text-end text-base font-extrabold text-stone-900">{f.value || '—'}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {reminders.length > 0 && (
          <section className="mt-4 rounded-3xl border border-stone-900/10 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-base font-bold text-stone-800">
              <BellRing size={18} className="text-secondary" /> تذكيرات خاصة ({reminders.length})
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              {reminders.map((r) => {
                const at = customReminderFireAt(r, expiry)
                const past = !at || at <= now
                return (
                  <li key={r.key} className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-3">
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${past ? 'bg-stone-300' : r.jobId ? 'bg-green-500' : 'bg-amber-500'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold text-stone-900">{describeReminder(r)}</p>
                      {r.note && <p className="mt-0.5 text-sm font-semibold text-stone-500">{r.note}</p>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {links.length > 0 && (
          <section className="mt-4 rounded-3xl border border-stone-900/10 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-base font-bold text-stone-800">
              <Link2 size={18} className="text-primary" /> روابط ({links.length})
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              {links.map((l, i) => (
                <li key={`${l.url}-${i}`}>
                  <a
                    href={normalizeUrl(l.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex min-h-[60px] items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-3 transition active:scale-[0.98] hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Globe size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold text-stone-900" dir="auto">{l.title || hostOf(l.url)}</p>
                      <p className="truncate text-xs font-semibold text-stone-500" dir="ltr">{hostOf(l.url)}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white">
                      فتح <ExternalLink size={15} />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* عرض صورة الوثيقة */}
        {displayImage && (
          <section className="mt-4 rounded-3xl border border-stone-900/10 bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-stone-800">صورة الوثيقة</h3>
            <div className="mt-3 overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
              {imgFailed ? (
                <div className="flex h-40 flex-col items-center justify-center gap-2 text-stone-400">
                  <FileText size={32} />
                  <span className="text-sm font-bold">تعذّر تحميل الصورة</span>
                </div>
              ) : (
                <img
                  src={displayImage}
                  alt={`صورة ${doc.name || 'الوثيقة'}`}
                  className="w-full object-contain max-h-96"
                  onError={() => setImgFailed(true)}
                />
              )}
            </div>
          </section>
        )}

        {/* عرض الملفات المرفقة (PDF وغيرها) */}
        {files.length > 0 && (
          <section className="mt-4 rounded-3xl border border-stone-900/10 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-base font-bold text-stone-800">
              <Paperclip size={18} className="text-stone-400" /> ملفات مرفقة ({files.length})
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              {files.map((f, i) => {
                const ext = fileExt(f.name)
                return (
                  <li key={f.url || i} className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-3">
                    <span className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ${ext === 'pdf' ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'}`}>
                      <FileText size={20} />
                      <span className="text-[10px] font-black uppercase leading-none">{ext || 'file'}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold text-stone-900" dir="auto">{f.name}</p>
                      <p className="text-xs font-semibold text-stone-500">{formatSize(f.size)}</p>
                    </div>
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="فتح الملف"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-primary/25 bg-white text-primary transition active:scale-90 hover:bg-primary/5"
                    >
                      <ExternalLink size={19} />
                    </a>
                    <button
                      onClick={() => saveFile(f)}
                      disabled={savingFile === f.url}
                      title="تنزيل الملف"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition active:scale-90 hover:opacity-90 disabled:opacity-60"
                    >
                      {savingFile === f.url ? <Loader2 size={19} className="animate-spin" /> : <Download size={19} />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <div className="mt-6 flex gap-3">
          <Link
            to={`/folder/${actualFolderId}/doc/${docId}/edit`}
            className="flex min-h-[58px] flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-white shadow-lg shadow-primary/25 transition active:scale-95 hover:opacity-90"
          >
            <Pencil size={20} />
            تعديل
          </Link>
          <button
            onClick={() => setConfirming(true)}
            className="flex min-h-[58px] flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-red-200 bg-red-50 text-lg font-bold text-red-600 transition active:scale-95 hover:bg-red-100"
          >
            <Trash2 size={20} />
            حذف الوثيقة
          </button>
        </div>
        <Link
          to={`/folder/${actualFolderId}`}
          className="mt-3 flex min-h-[54px] w-full items-center justify-center rounded-2xl border-2 border-stone-200 bg-white text-lg font-bold text-stone-600 transition active:scale-95 hover:bg-stone-50"
        >
          عودة
        </Link>
      </main>

      <ConfirmDialog
        open={confirming}
        title="حذف الوثيقة؟"
        message={`سيتم حذف «${doc.name || 'الوثيقة'}» نهائياً وإلغاء تنبيهاتها. لا يمكن التراجع عن هذه الخطوة.`}
        confirmLabel="حذف"
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setConfirming(false)}
      />
    </div>
  )
}