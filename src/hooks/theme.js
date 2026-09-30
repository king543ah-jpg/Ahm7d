// Light / dark appearance — a per-device display preference (no JSX).
import { useEffect, useState } from 'react'

const KEY = 'app-theme'
const EVENT = 'app-theme-change'
const BG = { light: '#f6f2e9', dark: '#111513' }

function systemPrefersDark() {
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

export function getTheme() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {}
  return systemPrefersDark() ? 'dark' : 'light'
}

export function applyTheme(theme) {
  try {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', BG[theme] || BG.light)
  } catch {}
}

export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme) } catch {}
  try {
    const root = document.documentElement
    root.classList.add('theme-anim')
    setTimeout(() => root.classList.remove('theme-anim'), 450)
  } catch {}
  applyTheme(theme)
  try { window.dispatchEvent(new CustomEvent(EVENT, { detail: theme })) } catch {}
}

/** [theme, toggle] — re-renders every consumer when the theme changes anywhere. */
export function useTheme() {
  const [theme, setState] = useState(getTheme)
  useEffect(() => {
    const onChange = (e) => setState(e.detail)
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [])
  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark')
  return [theme, toggle]
}