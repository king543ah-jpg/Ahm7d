import React, { useState } from 'react'
import { submitGateCode } from '../lib/_gate'

const isArabic =
  (typeof document !== 'undefined' &&
    (document.documentElement.dir === 'rtl' ||
      /^ar\b/i.test(document.documentElement.lang || ''))) ||
  (typeof navigator !== 'undefined' && /^ar\b/i.test(navigator.language || ''))

const T = isArabic
  ? {
      private: 'تطبيق خاص',
      title: 'هذا التطبيق خاص',
      desc: 'أدخل رمز الدخول للمتابعة',
      placeholder: 'رمز الدخول',
      enter: 'دخول',
      wrong: 'رمز غير صحيح. حاول مرة أخرى.',
      tooMany: 'محاولات كثيرة. انتظر دقيقة ثم حاول مرة أخرى.',
      offline: 'تعذّر الوصول إلى الخادم. تحقّق من اتصالك بالإنترنت.',
      failed: 'حدث خطأ ما. حاول مرة أخرى.',
      welcome: 'أهلاً بك',
      remembered: 'سنتذكّر هذا الجهاز.',
      opening: 'جارٍ الفتح…',
      hint: 'لا تملك رمزًا؟ اسأل المالك.',
      stealthTitle: 'تطبيق خاص',
    }
  : {
      private: 'Private',
      title: 'This app is private',
      desc: 'Enter your access code',
      placeholder: 'Access code',
      enter: 'Enter',
      wrong: 'Wrong code. Try again.',
      tooMany: 'Too many tries. Wait a minute and try again.',
      offline: "Can't reach the server. Check your connection.",
      failed: 'Something went wrong. Try again.',
      welcome: "You're in",
      remembered: "We'll remember this device.",
      opening: 'Opening…',
      hint: 'Need a code? Ask the owner.',
      stealthTitle: 'Private app',
    }

export function gateFailureKey(r) {
  if (!r) return 'failed'
  if (r.status === 403 || r.code === 'INVALID_CODE' || r.code === 'FORBIDDEN') return 'wrong'
  if (r.status === 429 || r.code === 'RATE_LIMITED' || r.code === 'DAILY_LIMIT') return 'tooMany'
  if (!r.status && (r.code === 'TIMEOUT' || r.code === 'NETWORK')) return 'offline'
  return 'failed'
}

export default function GateLock({ status = {} }) {
  const stealth = !!status.stealth
  const brand = status.themeColor && /^#?[0-9a-fA-F]{3,8}$/.test(status.themeColor)
    ? (status.themeColor[0] === '#' ? status.themeColor : `#${status.themeColor}`)
    : '#4F46E5'
  const dark = '#1c1a17'

  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (busy || !code.trim()) return
    setBusy(true)
    setErr('')
    let r
    try { r = await submitGateCode(code.trim()) } catch (ex) { r = { ok: false, code: (ex && ex.code) || 'NETWORK' } }
    if (r && r.ok) {
      setDone(true)
      setTimeout(() => window.location.reload(), 650)
    } else {
      setErr(T[gateFailureKey(r)])
      setBusy(false)
    }
  }

  const accent = stealth ? dark : brand
  const wrap = {
    position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    padding: '24px 28px', boxSizing: 'border-box',
    direction: isArabic ? 'rtl' : 'ltr',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#0c0b0a', color: '#f3f4f6', zIndex: 99999,
  }
  const badgeStyle = {
    display: 'inline-block', padding: '6px 14px', borderRadius: '999px',
    backgroundColor: stealth ? '#1d1a16' : `${accent}20`,
    color: stealth ? '#a8a29e' : accent,
    fontSize: '12px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '16px',
  }
  const headingStyle = { fontSize: '26px', fontWeight: '800', margin: '0 0 8px 0', color: '#ffffff' }
  const descStyle = { fontSize: '14px', color: '#9ca3af', margin: '0 0 28px 0', maxWidth: '300px', lineHeight: '1.5' }
  const inputStyle = {
    width: '100%', maxWidth: '320px', padding: '16px 18px', fontSize: '18px',
    fontWeight: '700', letterSpacing: '0.12em', textAlign: 'center', color: '#ffffff',
    backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '16px',
    outline: 'none', transition: 'all 0.15s ease', boxSizing: 'border-box',
  }
  const buttonStyle = {
    width: '100%', maxWidth: '320px', padding: '16px', marginTop: '12px',
    fontSize: '16px', fontWeight: '700', color: '#ffffff', backgroundColor: accent,
    border: 'none', borderRadius: '16px', cursor: busy ? 'default' : 'pointer',
    opacity: busy ? 0.7 : 1, transition: 'all 0.15s ease', boxSizing: 'border-box',
  }
  const errStyle = { marginTop: '14px', fontSize: '13px', fontWeight: '600', color: '#f87171', maxWidth: '300px' }

  return (
    <div style={wrap}>
      <div style={{ width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={badgeStyle}>{stealth ? T.stealthTitle : T.private}</span>
        <h1 style={headingStyle}>{T.title}</h1>
        <p style={descStyle}>{T.desc}</p>
        {done ? (
          <div style={{ padding: '20px', color: '#34d399', fontSize: '15px', fontWeight: '700' }}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{T.welcome}</div>
            <div style={{ color: '#9ca3af', fontSize: '13px', fontWeight: '500' }}>{T.remembered}</div>
          </div>
        ) : (
          <form onSubmit={submit} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <input
              type="password"
              value={code}
              onChange={(e) => { setCode(e.target.value); setErr('') }}
              placeholder={T.placeholder}
              disabled={busy}
              autoFocus
              autoComplete="current-password"
              style={inputStyle}
            />
            <button type="submit" disabled={busy || !code.trim()} style={buttonStyle}>
              {busy ? T.opening : T.enter}
            </button>
            {err ? <div style={errStyle}>{err}</div> : null}
          </form>
        )}
      </div>
    </div>
  )
}