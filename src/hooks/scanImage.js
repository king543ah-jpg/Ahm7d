// Document-scan helpers: rotate / crop / "scanner" filters on a canvas, and a
// tiny genuine-PDF writer that embeds the scanned JPEG pages (one per page).

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

const imgCache = new Map()
async function getImg(src) {
  if (!imgCache.has(src)) imgCache.set(src, loadImage(src))
  return imgCache.get(src)
}
export function forgetImage(src) { imgCache.delete(src) }

function percentile(hist, total, p) {
  const target = total * p
  let acc = 0
  for (let i = 0; i < 256; i++) {
    acc += hist[i]
    if (acc >= target) return i
  }
  return 255
}

function applyFilter(ctx, w, h, filter) {
  if (filter === 'original') return
  const data = ctx.getImageData(0, 0, w, h)
  const px = data.data
  const hist = new Uint32Array(256)
  const step = Math.max(1, Math.floor((w * h) / 200000))
  let total = 0
  for (let i = 0; i < px.length; i += 4 * step) {
    const l = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000
    hist[l | 0]++
    total++
  }
  const lo = percentile(hist, total, 0.02)
  const hi = Math.max(lo + 30, percentile(hist, total, 0.97))
  const scale = 255 / (hi - lo)

  if (filter === 'bw') {
    // Scanner look: grayscale, stretch, then a soft S-curve that whitens paper.
    const lut = new Uint8ClampedArray(256)
    for (let i = 0; i < 256; i++) {
      const g = Math.min(255, Math.max(0, (i - lo) * scale))
      lut[i] = 255 / (1 + Math.exp(-(g - 135) / 16))
    }
    for (let i = 0; i < px.length; i += 4) {
      const l = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000
      const v = lut[l | 0]
      px[i] = v; px[i + 1] = v; px[i + 2] = v
    }
  } else {
    // Enhanced color: auto-levels + gentle brightening.
    const lut = new Uint8ClampedArray(256)
    for (let i = 0; i < 256; i++) {
      const g = Math.min(255, Math.max(0, (i - lo) * scale)) / 255
      lut[i] = Math.pow(g, 0.85) * 255
    }
    for (let i = 0; i < px.length; i += 4) {
      px[i] = lut[px[i]]; px[i + 1] = lut[px[i + 1]]; px[i + 2] = lut[px[i + 2]]
    }
  }
  ctx.putImageData(data, 0, 0)
}

/**
 * Render one scanned page.
 * page: { src, rotation (0|90|180|270), crop {x,y,w,h} fractions of the ROTATED image, filter }
 * opts: { maxDim, useCrop }
 */
export async function renderPage(page, { maxDim = 1800, useCrop = true } = {}) {
  const img = await getImg(page.src)
  const rot = ((page.rotation || 0) % 360 + 360) % 360
  const swap = rot === 90 || rot === 270
  const rw = swap ? img.naturalHeight : img.naturalWidth
  const rh = swap ? img.naturalWidth : img.naturalHeight

  const crop = useCrop && page.crop ? page.crop : { x: 0, y: 0, w: 1, h: 1 }
  const cw = rw * crop.w
  const ch = rh * crop.h
  const s = Math.min(1, maxDim / Math.max(cw, ch))
  const outW = Math.max(1, Math.round(cw * s))
  const outH = Math.max(1, Math.round(ch * s))

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, outW, outH)
  ctx.save()
  ctx.scale(s, s)
  ctx.translate(-rw * crop.x, -rh * crop.y)
  // rotate around the rotated-canvas origin
  ctx.translate(rw / 2, rh / 2)
  ctx.rotate((rot * Math.PI) / 180)
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
  ctx.restore()
  applyFilter(ctx, outW, outH, page.filter || 'enhance')
  return canvas
}

export function canvasToJpeg(canvas, quality = 0.85) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality)
  })
}

/**
 * Build a real PDF file from JPEG pages.
 * pages: [{ bytes: Uint8Array (JPEG), width, height }]
 * Each page is A4 width (595pt) with the image filling it proportionally.
 */
export function buildPdf(pages) {
  const enc = new TextEncoder()
  const chunks = []
  let offset = 0
  const offsets = []
  const push = (part) => {
    const b = typeof part === 'string' ? enc.encode(part) : part
    chunks.push(b)
    offset += b.length
  }
  const startObj = (n) => { offsets[n] = offset; push(`${n} 0 obj\n`) }

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  const n = pages.length
  // object numbers: 1 catalog, 2 pages, then per page: page, image, content
  const pageObj = (i) => 3 + i * 3
  const imgObj = (i) => 4 + i * 3
  const contObj = (i) => 5 + i * 3

  startObj(1)
  push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  startObj(2)
  push(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] >>\nendobj\n`)

  pages.forEach((p, i) => {
    const W = 595
    const H = Math.max(1, Math.round((p.height / p.width) * W))
    startObj(pageObj(i))
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${i} ${imgObj(i)} 0 R >> >> /Contents ${contObj(i)} 0 R >>\nendobj\n`)
    startObj(imgObj(i))
    push(`<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`)
    push(p.bytes)
    push('\nendstream\nendobj\n')
    const content = `q ${W} 0 0 ${H} 0 0 cm /Im${i} Do Q`
    startObj(contObj(i))
    push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`)
  })

  const total = 3 + n * 3
  const xrefAt = offset
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`
  for (let k = 1; k < total; k++) xref += `${String(offsets[k]).padStart(10, '0')} 00000 n \n`
  push(xref)
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`)
  return new Blob(chunks, { type: 'application/pdf' })
}