import { statusOf, STATUS_META } from '../hooks/docStatus'

export default function StatusBadge({ expiryDate, className = '' }) {
  const status = statusOf(expiryDate)
  const meta = STATUS_META[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${meta.badge} ${className}`}
    >
      <span aria-hidden>{meta.dot}</span>
      {meta.label}
    </span>
  )
}