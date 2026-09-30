export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-6"
      style={{ height: 'var(--visual-height, 100dvh)' }}
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-black/45" />
      <div
        className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        style={{ maxHeight: 'calc(var(--visual-height, 100dvh) - 3rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-xl font-bold text-stone-900">{title}</h3>
        {message && <p className="mt-2 text-base leading-relaxed text-stone-600">{message}</p>}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="min-h-[48px] flex-1 rounded-2xl border-2 border-stone-200 text-lg font-bold text-stone-600 transition active:scale-95 hover:bg-stone-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`min-h-[48px] flex-1 rounded-2xl text-lg font-bold text-white transition active:scale-95 disabled:opacity-60 ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:opacity-90'
            }`}
          >
            {busy ? 'جارٍ الحذف…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}