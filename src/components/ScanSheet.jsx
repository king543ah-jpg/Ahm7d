import { useEffect, useRef, useState } from 'react'
import { X, Camera, RotateCw, Check, Trash2, Plus, Loader2, ImagePlus, FileText, Crop, ArrowRight, Pencil } from 'lucide-react'
import { storage } from '../lib/storage'
import { renderPage, canvasToJpeg, buildPdf, forgetImage } from '../hooks/scanImage'
import { checkQuota, quotaMessage } from '../hooks/storageQuota'

const FILTERS = [
  { id: 'enhance', label: 'محسّن' },
  { id: 'bw', label: 'مسح ضوئي' },
  { id: 'original', label: 'الأصلي' },
]
const FULL = { x: 0, y: 0, w: 1, h: 1 }
const INSET = { x: 0.04, y: 0.04, w: 0.92, h: 0.92 }

/** Crop editor: rotated+filtered preview with a draggable 4-corner crop box. */
function CropEditor({ page, onChange }) {
  const [preview, setPreview] = useState(null)
  const boxRef = useRef(null)
  const drag = useRef(null)

  useEffect(() => {
    let alive = true
    setPreview(null)
    renderPage(page, { maxDim: 1100, useCrop: false })
      .then((c) => alive && setPreview(c.toDataURL('image/jpeg', 0.8)))
      .catch(() => {})
    return () => { alive = false }
  }, [page.src, page.rotation, page.filter])

  const crop = page.crop || FULL

  function onDown(corner, e) {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    drag.current = { corner, startX: e.clientX, startY: e.clientY, start: { ...crop } }
  }
  function onMove(e) {
    const d = drag.current
    if (!d || !boxRef.current) return
    const rect = boxRef.current.getBoundingClientRect()
    const dx = (e.clientX - d.startX) / rect.width
    const dy = (e.clientY - d.startY) / rect.height
    const MIN = 0.12
    let { x, y, w, h } = d.start
    let x2 = x + w
    let y2 = y + h
    if (d.corner.includes('l')) x = Math.min(Math.max(0, x + dx), x2 - MIN)
    if (d.corner.includes('r')) x2 = Math.max(Math.min(1, x2 + dx), x + MIN)
    if (d.corner.includes('t')) y = Math.min(Math.max(0, y + dy), y2 - MIN)
    if (d.corner.includes('b')) y2 = Math.max(Math.min(1, y2 + dy), y + MIN)
    onChange({ ...page, crop: { x, y, w: x2 - x, h: y2 - y } })
  }
  function onUp() { drag.current = null }

  const handles = [
    { id: 'tl', style: { left: `${crop.x * 100}%`, top: `${crop.y * 100}%` } },
    { id: 'tr', style: { left: `${(crop.x + crop.w) * 100}%`, top: `${crop.y * 100}%` } },
    { id: 'bl', style: { left: `${crop.x * 100}%`, top: `${(crop.y + crop.h) * 100}%` } },
    { id: 'br', style: { left: `${(crop.x + crop.w) * 100}%`, top: `${(crop.y + crop.h) * 100}%` } },
  ]

  return (
    <div className="flex h-full w-full items-center justify-center">
      {!preview ? (
        <Loader2 className="animate-spin text-white/70" size={32} />
      ) : (
        <div
          ref={boxRef}
          className="relative max-h-full touch-none select-none"
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <img src={preview} alt="معاينة الصفحة" className="block max-w-full" style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 270px)' }} draggable={false} />
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute border-2 border-white"
              style={{
                left: `${crop.x * 100}%`, top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`, height: `${crop.h * 100}%`,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
              }}
            />
          </div>
          {handles.map((hd) => (
            <span
              key={hd.id}
              onPointerDown={(e) => onDown(hd.id, e)}
              className="absolute z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
              style={hd.style}
            >
              <span className="h-5 w-5 rounded-full border-[3px] border-white bg-[rgb(var(--color-primary))] shadow-lg" />
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Thumb({ page, onClick, index, onRemove }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let alive = true
    renderPage(page, { maxDim: 500 }).then((c) => alive && setUrl(c.toDataURL('image/jpeg', 0.75))).catch(() => {})
    return () => { alive = false }
  }, [page.src, page.rotation, page.filter, page.crop?.x, page.crop?.y, page.crop?.w, page.crop?.h])
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        className="block aspect-[3/4] w-full overflow-hidden rounded-2xl border-2 border-white/15 bg-white/5 transition active:scale-95"
      >
        {url ? <img src={url} alt={`صفحة ${index + 1}`} className="h-full w-full object-contain" /> : <Loader2 className="m-auto animate-spin text-white/60" />}
      </button>
      <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 text-xs font-bold text-white">{index + 1}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title="حذف الصفحة"
          className="absolute left-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white active:scale-90"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  )
}

/**
 * Full-screen document scanner.
 * onDone({ pdf?: {name,url,size,type}, imageUrl? }) — called after upload.
 */
export default function ScanSheet({ open, docName, hasImage, onClose, onDone }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileRef = useRef(null)
  const galleryRef = useRef(null)
  const [mode, setMode] = useState('camera') // camera | edit | review
  const [camState, setCamState] = useState('idle') // idle | starting | live | failed
  const [pages, setPages] = useState([])
  const [editIdx, setEditIdx] = useState(-1)
  const [savePdf, setSavePdf] = useState(true)
  const [asImage, setAsImage] = useState(!hasImage)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pagesLen = useRef(0)
  pagesLen.current = pages.length

  // Start/stop the camera with the sheet.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setMode('camera'); setPages([]); setEditIdx(-1); setError(''); setAsImage(!hasImage); setSavePdf(true)
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) { setCamState('failed'); return }
      setCamState('starting')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setCamState('live')
      } catch (err) {
        console.warn('[scan] camera unavailable:', err)
        if (!cancelled) setCamState('failed')
      }
    }
    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Free object URLs when the sheet closes.
  useEffect(() => {
    if (open) return
    setPages((ps) => {
      ps.forEach((p) => { try { URL.revokeObjectURL(p.src) } catch {} ; forgetImage(p.src) })
      return []
    })
  }, [open])

  // Re-attach the stream when returning to the camera view.
  useEffect(() => {
    if (mode === 'camera' && videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [mode])

  if (!open) return null

  function addPage(src) {
    const idx = pagesLen.current
    pagesLen.current = idx + 1
    setPages((ps) => [...ps, { src, rotation: 0, crop: INSET, filter: 'enhance' }])
    setEditIdx(idx)
    setMode('edit')
  }

  function capture() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    c.toBlob((b) => { if (b) addPage(URL.createObjectURL(b)) }, 'image/jpeg', 0.92)
  }

  function onPickPhotos(e) {
    const picked = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'))
    e.target.value = ''
    if (!picked.length) return
    if (picked.length === 1) { addPage(URL.createObjectURL(picked[0])); return }
    setPages((ps) => [...ps, ...picked.map((f) => ({ src: URL.createObjectURL(f), rotation: 0, crop: FULL, filter: 'enhance' }))])
    setMode('review')
  }

  function updatePage(i, p) { setPages((ps) => ps.map((x, idx) => (idx === i ? p : x))) }
  function removePage(i) {
    setPages((ps) => {
      const p = ps[i]
      if (p) { try { URL.revokeObjectURL(p.src) } catch {} ; forgetImage(p.src) }
      return ps.filter((_, idx) => idx !== i)
    })
  }

  async function finish() {
    if (!pages.length || (!savePdf && !asImage)) return
    setBusy(true)
    setError('')
    try {
      const rendered = []
      for (const p of pages) {
        const canvas = await renderPage(p, { maxDim: 1800 })
        const blob = await canvasToJpeg(canvas, 0.85)
        rendered.push({ blob, width: canvas.width, height: canvas.height })
      }
      const result = {}
      const stamp = Date.now()
      let pdf = null
      if (savePdf) {
        const pdfPages = []
        for (const r of rendered) pdfPages.push({ bytes: new Uint8Array(await r.blob.arrayBuffer()), width: r.width, height: r.height })
        pdf = buildPdf(pdfPages)
        if (pdf.size > 25 * 1024 * 1024) throw new Error('too-big')
      }
      const need = (asImage ? rendered[0].blob.size : 0) + (pdf ? pdf.size : 0)
      const q = await checkQuota(need)
      if (!q.ok) {
        const e = new Error('quota')
        e.remaining = q.remaining
        throw e
      }
      if (asImage) {
        const { url } = await storage.upload(rendered[0].blob, `scan-${stamp}.jpg`)
        result.imageUrl = url
      }
      if (pdf) {
        const safe = (docName || 'مستند').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'مستند'
        const niceName = `${safe} - مسح ضوئي.pdf`
        const { url } = await storage.upload(pdf, `scan-${stamp}.pdf`)
        result.pdf = { name: niceName, url, size: pdf.size, type: 'application/pdf' }
      }
      onDone(result)
    } catch (err) {
      console.error(err)
      setError(
        err.message === 'too-big' ? 'الملف أكبر من 25 ميجابايت — قلّل عدد الصفحات.'
          : err.message === 'quota' ? quotaMessage(err.remaining)
          : 'تعذّر حفظ المسح — حاول مرة أخرى.',
      )
      setBusy(false)
    }
  }

  const editing = mode === 'edit' && pages[editIdx]

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#0c0f0e] text-white" dir="rtl">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
        <button
          type="button"
          onClick={() => {
            if (busy) return
            if (mode === 'edit') setMode(pages.length > 1 ? 'review' : 'camera')
            else if (mode === 'review') setMode('camera')
            else onClose()
          }}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 transition active:scale-90"
          title={mode === 'camera' ? 'إغلاق' : 'عودة'}
        >
          {mode === 'camera' ? <X size={22} /> : <ArrowRight size={22} />}
        </button>
        <h2 className="font-display text-lg font-extrabold">
          {mode === 'camera' ? 'تصوير المستند' : mode === 'edit' ? `تعديل الصفحة ${editIdx + 1}` : `مراجعة (${pages.length} ${pages.length > 2 && pages.length < 11 ? 'صفحات' : 'صفحة'})`}
        </h2>
        {mode === 'camera' && pages.length > 0 ? (
          <button
            type="button"
            onClick={() => setMode('review')}
            className="flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-[rgb(var(--color-primary))] px-4 text-sm font-bold active:scale-95"
          >
            <Check size={18} /> تم ({pages.length})
          </button>
        ) : <span className="w-11" />}
      </div>

      {/* Camera view (kept mounted so the stream survives mode switches) */}
      <div className={`${mode === 'camera' ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col`}>
        <div className="relative mx-4 min-h-0 flex-1 overflow-hidden rounded-3xl bg-black">
          <video ref={videoRef} playsInline muted autoPlay className={`h-full w-full object-cover ${camState === 'live' ? '' : 'invisible'}`} />
          {camState === 'live' && (
            <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-dashed border-white/50">
              <span className="absolute -top-3 right-1/2 translate-x-1/2 rounded-full bg-black/60 px-3 py-0.5 text-xs font-bold">ضع المستند داخل الإطار</span>
            </div>
          )}
          {camState === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
              <Loader2 className="animate-spin" size={32} />
              <span className="font-bold">جارٍ تشغيل الكاميرا…</span>
            </div>
          )}
          {camState === 'failed' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
              <Camera size={44} className="text-white/40" />
              <p className="text-base font-bold leading-relaxed text-white/80">
                تعذّر فتح الكاميرا داخل التطبيق. اسمح بالوصول للكاميرا من إعدادات المتصفح، أو استخدم كاميرا الجهاز مباشرة:
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex min-h-[54px] items-center gap-2 rounded-2xl bg-[rgb(var(--color-primary))] px-6 text-lg font-bold active:scale-95"
              >
                <Camera size={22} /> التقاط صورة
              </button>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-around px-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-5">
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-white/10 transition active:scale-90"
            title="من المعرض"
          >
            <ImagePlus size={22} />
            <span className="text-[10px] font-bold">المعرض</span>
          </button>
          <button
            type="button"
            onClick={camState === 'live' ? capture : () => fileRef.current?.click()}
            className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/80 transition active:scale-90"
            title="التقاط"
            aria-label="التقاط صورة"
          >
            <span className="h-16 w-16 rounded-full bg-[#ffffff]" />
          </button>
          <div className="relative h-14 w-14">
            {pages.length > 0 ? (
              <button type="button" onClick={() => setMode('review')} className="h-14 w-14 overflow-hidden rounded-2xl border-2 border-white/40 active:scale-90">
                <img src={pages[pages.length - 1].src} alt="آخر صفحة" className="h-full w-full object-cover" />
                <span className="absolute -left-1.5 -top-1.5 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[rgb(var(--color-secondary))] px-1 text-xs font-black">{pages.length}</span>
              </button>
            ) : null}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickPhotos} />
        <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickPhotos} />
      </div>

      {/* Edit a page */}
      {editing && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 px-4">
            <CropEditor page={editing} onChange={(p) => updatePage(editIdx, p)} />
          </div>
          <div className="shrink-0 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-3">
            <div className="flex justify-center gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => updatePage(editIdx, { ...editing, filter: f.id })}
                  className={`min-h-[44px] rounded-2xl px-4 text-sm font-bold transition active:scale-95 ${editing.filter === f.id ? 'bg-[#ffffff] text-[#0c0f0e]' : 'bg-white/10 text-white'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => { removePage(editIdx); setMode(pages.length > 1 ? 'review' : 'camera') }}
                className="flex min-h-[52px] items-center justify-center gap-1.5 rounded-2xl bg-white/10 px-4 font-bold active:scale-95"
              >
                <Trash2 size={18} /> إعادة
              </button>
              <button
                type="button"
                onClick={() => updatePage(editIdx, { ...editing, rotation: ((editing.rotation || 0) + 90) % 360, crop: FULL })}
                className="flex min-h-[52px] items-center justify-center gap-1.5 rounded-2xl bg-white/10 px-4 font-bold active:scale-95"
              >
                <RotateCw size={18} /> تدوير
              </button>
              <button
                type="button"
                onClick={() => updatePage(editIdx, { ...editing, crop: FULL })}
                className="flex min-h-[52px] items-center justify-center gap-1.5 rounded-2xl bg-white/10 px-3 font-bold active:scale-95"
                title="إلغاء القص"
              >
                <Crop size={18} />
              </button>
              <button
                type="button"
                onClick={() => setMode('review')}
                className="flex min-h-[52px] flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[rgb(var(--color-primary))] font-bold active:scale-95"
              >
                <Check size={20} /> تأكيد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review all pages + save */}
      {mode === 'review' && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {pages.map((p, i) => (
                <div key={p.src}>
                  <Thumb page={p} index={i} onClick={() => { setEditIdx(i); setMode('edit') }} onRemove={() => removePage(i)} />
                  <button
                    type="button"
                    onClick={() => { setEditIdx(i); setMode('edit') }}
                    className="mt-1 flex w-full items-center justify-center gap-1 text-xs font-bold text-white/60"
                  >
                    <Pencil size={12} /> تعديل
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setMode('camera')}
                className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/25 text-white/70 transition active:scale-95"
              >
                <Plus size={28} />
                <span className="text-sm font-bold">إضافة صفحة</span>
              </button>
            </div>
          </div>
          <div className="shrink-0 border-t border-white/10 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-3">
            {error && <p className="mb-2 rounded-xl bg-red-500/20 px-3 py-2 text-sm font-bold text-red-200">{error}</p>}
            <label className="flex min-h-[44px] items-center gap-3 font-bold">
              <input type="checkbox" checked={savePdf} onChange={(e) => setSavePdf(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--color-primary))]" />
              <FileText size={18} className="text-red-300" /> حفظ الصفحات كملف PDF مرفق
            </label>
            <label className="flex min-h-[44px] items-center gap-3 font-bold">
              <input type="checkbox" checked={asImage} onChange={(e) => setAsImage(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--color-primary))]" />
              <ImagePlus size={18} className="text-white/70" /> استخدام الصفحة الأولى كصورة الوثيقة
            </label>
            <button
              type="button"
              onClick={finish}
              disabled={busy || !pages.length || (!savePdf && !asImage)}
              className="mt-2 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-[rgb(var(--color-primary))] text-lg font-bold transition active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? <Loader2 className="animate-spin" size={22} /> : <Check size={22} />}
              {busy ? 'جارٍ الحفظ…' : 'إرفاق بالوثيقة'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}