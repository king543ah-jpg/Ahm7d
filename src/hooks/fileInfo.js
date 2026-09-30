// Small helpers for attached files.
export function fileExt(name) {
  const m = /\.([a-z0-9]{1,6})$/i.exec(String(name || ''))
  return m ? m[1].toLowerCase() : ''
}

export function formatSize(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} بايت`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} كيلوبايت`
  return `${(n / (1024 * 1024)).toFixed(1)} ميجابايت`
}