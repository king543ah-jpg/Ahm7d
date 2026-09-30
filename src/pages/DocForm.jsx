import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, Plus, X, ImagePlus, Loader2, Trash2, Paperclip, FileText, ScanLine, BellRing, Link2 } from 'lucide-react'
import ScanSheet from '../components/ScanSheet'
import LinksEditor, { normalizeUrl, isValidUrl } from '../components/LinksEditor'
import ReminderEditor from '../components/ReminderEditor'
import { formatSize, fileExt } from '../hooks/fileInfo'
import { db } from '../lib/db'
import { storage } from '../lib/storage'
import { scheduleExpiryReminder, scheduleCustomReminders } from '../hooks/reminders'

export default function DocForm() {
  const { folderId: routeFolderId, docId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const folderId = routeFolderId || searchParams.get('folderId') || ''
  const isEdit = !!docId

  const [loadingDoc, setLoadingDoc] = useState(isEdit)
  const [name, setName] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [fields, setFields] = useState([])
  const [imageUrl, setImageUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState([])
  const [uploadingFiles, setUploadingFiles] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [existingReminderId, setExistingReminderId] = useState(null)
  const [reminders, setReminders] = useState([])
  const [prevReminders, setPrevReminders] = useState([])
  const [links, setLinks] = useState([])
  const [scanOpen, setScanOpen] = useState(false)

  useEffect(() => {
    if (!isEdit) return
    let alive = true
    db.get('documents', docId)
      .then((doc) => {
        if (!alive || !doc) return
        setName(doc.name || doc.title || '')
        setExpiryDate(doc.expiryDate || doc.expiry_date || '')
        setFields(Array.isArray(doc.customFields) ? doc.customFields : (doc.custom_fields || []))
        setImageUrl(doc.imageUrl || doc.image_url || null)
        setFiles(Array.isArray(doc.files) ? doc.files : [])
        setExistingReminderId(doc.reminderId || doc.reminder_id || null)
        const rs = Array.isArray(doc.reminders) ? doc.reminders : []
        setReminders(rs)
        setPrevReminders(rs)
        setLinks(Array.isArray(doc.links) ? doc.links : [])
      })
      .catch(console.error)
      .finally(() => {
        if (alive) setLoadingDoc(false)
      })
    return () => { alive = false }
  }, [isEdit, docId])

  function addField() {
    setFields((f) => [...f, { label: '', value: '' }])
  }

  function updateField(i, key, val) {
    setFields((f) => f.map((row, idx) => (idx === i ? { ...row, [key]: val } : row)))
  }

  function removeField(i) {
    setFields((f) => f.filter((_, idx) => idx !== i))
  }

  async function onPickImage(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const res = await storage.upload(file, file.name || 'doc-image.jpg')
      if (res?.url) {
        setImageUrl(res.url)
      }
    } catch (err) {
      console.error(err)
      setError('تعذّر رفع الصورة — حاول مرة أخرى')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function onPickFiles(e) {
    const picked = Array.from(e.target.files || [])
    e.target.value = ''
    if (!picked.length) return
    setError('')

    setUploadingFiles(picked.length)

    for (const file of picked) {
      try {
        const res = await storage.upload(file, file.name)
        if (res?.url) {
          setFiles((list) => [...list, { name: file.name, url: res.url, size: file.size, type: file.type || '' }])
        }
      } catch (err) {
        console.error(err)
        setError(`تعذّر رفع الملف «${file.name}» — حاول مرة أخرى`)
      } finally {
        setUploadingFiles((n) => Math.max(0, n - 1))
      }
    }
  }

  async function removeFile(i) {
    const targetFile = files[i]
    setFiles((list) => list.filter((_, idx) => idx !== i))
    if (targetFile?.url) {
      await storage.delete(targetFile.url)
    }
  }

  function onScanDone({ pdf, imageUrl: scannedImage }) {
    if (scannedImage) setImageUrl(scannedImage)
    if (pdf) setFiles((list) => [...list, pdf])
    setScanOpen(false)
  }

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('يرجى إدخال اسم الوثيقة')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const filledLinks = links.filter((l) => (l.url || '').trim())
    if (filledLinks.some((l) => !isValidUrl(l.url))) {
      setError('في رابط مكتوب بشكل غير صحيح — صححه أو احذفه')
      return
    }

    setSaving(true)
    setError('')

    try {
      const id = isEdit ? docId : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const cleanFields = fields
        .map((f) => ({ label: (f.label || '').trim(), value: (f.value || '').trim() }))
        .filter((f) => f.label || f.value)

      const payload = {
        folderId,
        folder_id: folderId,
        name: trimmed,
        expiryDate: expiryDate || '',
        expiry_date: expiryDate || '',
        customFields: cleanFields,
        imageUrl: imageUrl || '',
        files,
        links: filledLinks.map((l) => ({ title: (l.title || '').trim(), url: normalizeUrl(l.url) })),
      }

      const reminderId = await scheduleExpiryReminder(
        { ...payload, id, folderId },
        existingReminderId,
      )
      payload.reminderId = reminderId || ''

      const cleanReminders = reminders
        .filter((r) => {
          if (r.type === 'before') {
            return expiryDate && r.days !== '' && r.days != null
          }
          return !!r.date
        })
        .map((r) => ({
          ...r,
          days: r.type === 'before' ? Number(r.days) : undefined,
          title: (r.title || '').trim(),
          note: (r.note || '').trim(),
        }))

      payload.reminders = await scheduleCustomReminders(
        { ...payload, id, folderId },
        cleanReminders,
        prevReminders,
      )

      if (isEdit) {
        await db.update('documents', id, payload)
      } else {
        await db.insert('documents', payload)
      }

      if (folderId) {
        navigate(`/folder/${folderId}`, { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    } catch (err) {
      console.error(err)
      setError('تعذّر الحفظ — حاول مرة أخرى')
      setSaving(false)
    }
  }

  if (loadingDoc) {
    return (
      <div className="flex h-full items-center justify-center paper-bg text-stone-500">
        <Loader2 className="animate-spin" size={28} />
      </div>
    )
  }

  const backDestination = folderId
    ? (isEdit ? `/folder/${folderId}/doc/${docId}` : `/folder/${folderId}`)
    : '/'

  return (
    <div className="h-full overflow-y-auto paper-bg">
      <header className="sticky top-0 z-20 border-b border-stone-900/10 bg-[#f6f2e9]/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 md:px-8">
          <Link
            to={backDestination}
            title="عودة"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-stone-900/10 bg-white text-stone-700 transition active:scale-95 hover:bg-stone-50"
          >
            <ArrowRight size={22} />
          </Link>
          <h1 className="font-display truncate text-xl font-extrabold text-stone-900 md:text-2xl">
            {isEdit ? 'تعديل الوثيقة' : 'وثيقة جديدة'}
          </h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-5 md:px-8">
        {error && (
          <div className="mb-4 rounded-2xl bg-red-100 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-3xl border border-stone-900/10 bg-white p-5 shadow-sm">
          <label className="block text-base font-bold text-stone-800">اسم الوثيقة *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: جواز السفر"
            className="mt-2 min-h-[56px] w-full rounded-2xl border-2 border-stone-200 bg-stone-50 px-4 text-lg font-semibold text-stone-900 outline-none transition focus:border-primary focus:bg-white"
          />

          <label className="mt-5 block text-base font-bold text-stone-800">تاريخ الانتهاء</label>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="mt-2 min-h-[56px] w-full rounded-2xl border-2 border-stone-200 bg-stone-50 px-4 text-lg font-semibold text-stone-900 outline-none transition focus:border-primary focus:bg-white"
          />
        </section>

        <section className="mt-4 rounded-3xl border border-stone-900/10 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-stone-800">
            <BellRing size={18} className="text-secondary" /> تذكيرات خاصة
          </h2>
          <ReminderEditor reminders={reminders} onChange={setReminders} expiryDate={expiryDate} />
        </section>

        <section className="mt-4 rounded-3xl border border-stone-900/10 bg-white p-5 shadow-sm">
          <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-stone-800">
            <Link2 size={18} className="text-primary" /> روابط مواقع إنترنت
          </h2>
          <LinksEditor links={links} onChange={setLinks} />
        </section>

        <section className="mt-4 rounded-3xl border border-stone-900/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-stone-800">معلومات إضافية</h2>
            <button
              type="button"
              onClick={addField}
              className="flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-primary/10 px-4 text-sm font-bold text-primary transition active:scale-95 hover:bg-primary/20"
            >
              <Plus size={18} />
              إضافة حقل
            </button>
          </div>

          {fields.length > 0 && (
            <ul className="mt-4 flex flex-col gap-3">
              {fields.map((f, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input
                    value={f.label}
                    onChange={(e) => updateField(i, 'label', e.target.value)}
                    placeholder="الاسم"
                    className="min-h-[52px] w-2/5 rounded-2xl border-2 border-stone-200 bg-stone-50 px-3 text-base font-semibold text-stone-900 outline-none transition focus:border-primary focus:bg-white"
                  />
                  <input
                    value={f.value}
                    onChange={(e) => updateField(i, 'value', e.target.value)}
                    placeholder="القيمة"
                    className="min-h-[52px] min-w-0 flex-1 rounded-2xl border-2 border-stone-200 bg-stone-50 px-3 text-base font-semibold text-stone-900 outline-none transition focus:border-primary focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => removeField(i)}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-stone-400 transition hover:bg-red-50 hover:text-red-600 active:scale-90"
                  >
                    <X size={20} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* صورة الوثيقة */}
        <section className="mt-4 rounded-3xl border border-stone-900/10 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-stone-800">صورة الوثيقة</h2>
          <button
            type="button"
            onClick={() => setScanOpen(true)}
            className="mt-3 flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-white shadow-lg shadow-primary/20 transition active:scale-[0.98] hover:opacity-90"
          >
            <ScanLine size={24} />
            تصوير المستند بالكاميرا
          </button>

          <label className="mt-3 flex min-h-[56px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 text-lg font-bold text-primary transition active:scale-[0.98] hover:bg-primary/10">
            {uploading ? <Loader2 className="animate-spin" size={22} /> : <ImagePlus size={22} />}
            {uploading ? 'جارٍ رفع الصورة…' : imageUrl ? 'تغيير الصورة من المعرض' : 'اختيار صورة من المعرض'}
            <input type="file" accept="image/*" className="hidden" onChange={onPickImage} disabled={uploading} />
          </label>

          {imageUrl && !uploading && (
            <div className="relative mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
              <img src={imageUrl} alt="معاينة الصورة" className="max-h-72 w-full object-contain" />
              <button
                type="button"
                onClick={async () => {
                  const old = imageUrl
                  setImageUrl(null)
                  await storage.delete(old)
                }}
                className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition active:scale-90"
              >
                <Trash2 size={18} />
              </button>
            </div>
          )}
        </section>

        {/* الملفات المرفقة (PDF) */}
        <section className="mt-4 rounded-3xl border border-stone-900/10 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-stone-800">ملفات مرفقة</h2>
          
          <label className={`mt-3 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-secondary/50 bg-secondary/10 text-lg font-bold text-secondary transition active:scale-[0.98] hover:bg-secondary/15 ${uploadingFiles ? 'pointer-events-none opacity-70' : 'cursor-pointer'}`}>
            {uploadingFiles ? <Loader2 className="animate-spin" size={22} /> : <Paperclip size={22} />}
            {uploadingFiles ? `جارٍ رفع ${uploadingFiles} ملف…` : 'إضافة ملف'}
            <input
              type="file"
              multiple
              accept=".pdf,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,image/*"
              className="hidden"
              onChange={onPickFiles}
              disabled={!!uploadingFiles}
            />
          </label>

          {files.length > 0 && (
            <ul className="mt-4 flex flex-col gap-2">
              {files.map((f, i) => (
                <li key={f.url || i} className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-3">
                  <span className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ${fileExt(f.name) === 'pdf' ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'}`}>
                    <FileText size={20} />
                    <span className="text-[10px] font-black uppercase leading-none">{fileExt(f.name) || 'file'}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-stone-900" dir="auto">{f.name}</p>
                    <p className="text-xs font-semibold text-stone-500">{formatSize(f.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stone-400 transition hover:bg-red-50 hover:text-red-600 active:scale-90"
                  >
                    <X size={20} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-6 flex gap-3">
          <Link
            to={backDestination}
            className="flex min-h-[58px] flex-1 items-center justify-center rounded-2xl border-2 border-stone-200 bg-white text-lg font-bold text-stone-600 transition active:scale-95 hover:bg-stone-50"
          >
            إلغاء
          </Link>
          <button
            type="button"
            onClick={save}
            disabled={saving || uploading || !!uploadingFiles}
            className="flex min-h-[58px] flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-white shadow-lg shadow-primary/25 transition active:scale-95 disabled:opacity-60"
          >
            {saving && <Loader2 className="animate-spin" size={20} />}
            {saving ? 'جارٍ الحفظ…' : 'حفظ'}
          </button>
        </div>
      </main>

      <ScanSheet
        open={scanOpen}
        docName={name.trim()}
        hasImage={!!imageUrl}
        onClose={() => setScanOpen(false)}
        onDone={onScanDone}
      />
    </div>
  )
}