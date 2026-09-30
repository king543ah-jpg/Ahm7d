import { useEffect, useState } from 'react'
import { Play, Square, Check, Loader2 } from 'lucide-react'
import { SOUND_OPTIONS, playSound, stopSound } from '../hooks/sounds'

/** Radio list of notification sounds, each with a preview button. */
export default function SoundPicker({ value, onChange, disabled, options = SOUND_OPTIONS }) {
  const [playing, setPlaying] = useState(null)
  const [loadingId, setLoadingId] = useState(null)

  useEffect(() => () => stopSound(), [])

  async function preview(id) {
    if (playing === id) {
      stopSound()
      setPlaying(null)
      return
    }
    setLoadingId(id)
    const ok = await playSound(id, { maxSec: 20 })
    setLoadingId(null)
    if (ok) {
      setPlaying(id)
      const opt = options.find((o) => o.id === id)
      setTimeout(() => setPlaying((p) => (p === id ? null : p)), opt?.kind === 'tone' ? 2600 : 20000)
    }
  }

  return (
    <ul className="flex flex-col gap-2">
      {options.map((o) => {
        const selected = value === o.id
        return (
          <li key={o.id} className="flex items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(o.id)}
              className={`flex min-h-[54px] flex-1 items-center gap-3 rounded-2xl border-2 px-4 text-start transition active:scale-[0.99] disabled:opacity-60 ${
                selected ? 'border-primary bg-primary/10' : 'border-stone-200 bg-stone-50 hover:bg-stone-100'
              }`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-primary bg-primary text-white' : 'border-stone-300'}`}>
                {selected && <Check size={14} strokeWidth={3} />}
              </span>
              <span className={`text-base font-bold ${selected ? 'text-primary' : 'text-stone-800'}`}>{o.label}</span>
            </button>
            <button
              type="button"
              onClick={() => preview(o.id)}
              title={playing === o.id ? 'إيقاف' : 'استماع'}
              className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-2xl border-2 border-stone-200 bg-white text-stone-600 transition active:scale-95 hover:bg-stone-50"
            >
              {loadingId === o.id ? <Loader2 size={20} className="animate-spin" /> : playing === o.id ? <Square size={18} /> : <Play size={20} />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}