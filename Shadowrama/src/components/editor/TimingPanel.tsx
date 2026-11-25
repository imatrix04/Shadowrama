import type { Slide } from '../../types'
import {
  DEFAULT_SLIDE_DURATION, MAX_SLIDE_DURATION, MIN_SLIDE_DURATION, slideDuration,
} from '../../utils/slideshow'
import styles from './PanelControls.module.css'

interface Props {
  slideIndex: number
  slide: Slide | undefined
  /** `undefined` rétablit la durée par défaut. */
  onChange: (duration: number | undefined) => void
}

const PRESETS = [5, 10, 30, 60, 120]

function label(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s ? `${m} min ${s} s` : `${m} min`
}

const INPUT_STYLE: React.CSSProperties = {
  width: 64, padding: '4px 6px', borderRadius: 6,
  border: '1px solid var(--border, #444)', background: 'transparent', color: 'inherit',
}

export default function TimingPanel({ slideIndex, slide, onChange }: Props) {
  const total = slide ? Math.round(slideDuration(slide)) : DEFAULT_SLIDE_DURATION
  const custom = slide?.duration !== undefined
  const minutes = Math.floor(total / 60)
  const seconds = total % 60

  const set = (m: number, s: number) => {
    const value = Math.round(m) * 60 + Math.round(s)
    if (!Number.isFinite(value)) return
    onChange(Math.min(MAX_SLIDE_DURATION, Math.max(MIN_SLIDE_DURATION, value)))
  }

  return (
    <>
      <p className={styles.subtle}>
        <strong>Diapositive {slideIndex + 1}</strong> — temps d'affichage en <strong>diaporama automatique</strong>.
      </p>

      <div className={styles.sliderBlock}>
        <div className={styles.sliderHead}>
          <span className={styles.fieldLabel}>Durée</span>
          <output className={styles.sliderValue}>{label(total)}</output>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="number" min={0} max={60} style={INPUT_STYLE}
            value={minutes} aria-label="Minutes"
            onChange={e => set(parseInt(e.target.value, 10) || 0, seconds)}
          /> min
          <input
            type="number" min={0} max={59} style={INPUT_STYLE}
            value={seconds} aria-label="Secondes"
            onChange={e => set(minutes, parseInt(e.target.value, 10) || 0)}
          /> s
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {PRESETS.map(p => (
          <button
            key={p} type="button" className={styles.remove}
            aria-pressed={total === p} onClick={() => onChange(p)}
          >
            {label(p)}
          </button>
        ))}
      </div>

      {custom && (
        <button type="button" className={styles.remove} style={{ marginTop: 10 }} onClick={() => onChange(undefined)}>
          rétablir la durée par défaut ({DEFAULT_SLIDE_DURATION} s)
        </button>
      )}

      <p className={styles.hint}>
        Sans effet en diaporama manuel. La durée démarre une fois la diapositive affichée.
      </p>
    </>
  )
}
