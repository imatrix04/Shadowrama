import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { ParticleSettings, ParticleShape } from '../../types'
import { PARTICLE_SHAPES } from '../../ultra/particles'
import { generateMediaKey, registerMedia, resolveMedia } from '../../utils/mediaStore'
import Icon from '../ui/Icon'
import menu from './ContextMenu.module.css'
import panel from './PanelControls.module.css'
import styles from './ParticleAmbiance.module.css'

// Positions des points de la mini-scène : fixes, pour un rendu pur et stable.
const DOTS = [
  { x: 12, y: 72 }, { x: 30, y: 28 }, { x: 50, y: 62 }, { x: 68, y: 22 },
  { x: 86, y: 66 }, { x: 22, y: 48 }, { x: 60, y: 82 }, { x: 42, y: 40 },
]

/**
 * Tuile d'ambiance : une petite scène sombre où quelques points reprennent la
 * forme, les couleurs et le mouvement du préréglage. Un dégradé uni (l'ancien
 * rendu) rendait illisibles les ambiances claires — poussière, neige, étoiles.
 */
export function AmbianceTile({ label, settings, active, onClick }: {
  label: string
  settings: ParticleSettings
  active: boolean
  onClick: () => void
}) {
  const colors = settings.colors.length > 0 ? settings.colors : ['#ffffff']
  const size = Math.min(9, 3 + settings.size * 0.8)
  const glow = Math.min(9, settings.glow / 2)

  return (
    <button
      type="button"
      className={`${styles.tile} ${active ? styles.tileActive : ''}`}
      onClick={onClick}
      aria-pressed={active}
      title={label}
    >
      <span className={`${styles.stage} ${styles[`motion_${settings.motion}`] ?? ''}`}>
        <span className={styles.field}>
        {DOTS.map((d, i) => (
          <span
            key={i}
            className={`${styles.dot} ${styles[`shape_${settings.shape}`] ?? ''}`}
            style={{
              left: `${d.x}%`,
              top: `${d.y}%`,
              '--c': colors[i % colors.length],
              '--s': `${size * (0.7 + (i % 3) * 0.25)}px`,
              '--g': `${glow}px`,
              '--i': i,
              '--o': Math.max(0.5, settings.opacity),
            } as CSSProperties}
          />
        ))}
        </span>
      </span>
      <span className={styles.tileName}>{label}</span>
    </button>
  )
}

/** Pictogrammes des formes de particules, assez grands pour se reconnaître. */
function ShapeGlyph({ shape }: { shape: ParticleShape }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true }
  switch (shape) {
    case 'circle': return <svg {...common}><circle cx="12" cy="12" r="4.5" /></svg>
    case 'glow':
      return (
        <svg {...common}>
          <defs>
            <radialGradient id="glyph-glow">
              <stop offset="0" stopColor="currentColor" />
              <stop offset="0.45" stopColor="currentColor" stopOpacity="0.55" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="12" cy="12" r="10" fill="url(#glyph-glow)" />
        </svg>
      )
    case 'square': return <svg {...common}><rect x="6.5" y="6.5" width="11" height="11" rx="1.5" /></svg>
    case 'triangle': return <svg {...common}><path d="M12 5l7 13H5z" /></svg>
    case 'star': return <svg {...common}><path d="M12 3.5l2.5 5.6 6.1.6-4.6 4.1 1.4 6-5.4-3.2-5.4 3.2 1.4-6L3.4 9.7l6.1-.6z" /></svg>
    case 'ring': return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="6" /></svg>
    case 'line': return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14" /></svg>
    case 'image':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="5" width="16" height="14" rx="2.5" />
          <circle cx="9" cy="10" r="1.6" fill="currentColor" stroke="none" />
          <path d="M5 17l4.5-4.5 3 3 2-2L19 17" />
        </svg>
      )
    case 'cross': return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
  }
}

/** Les formes du moteur, plus l'image importée (absente de la liste proposée à l'IA :
 *  elle ne peut pas fournir de fichier). */
const SHAPES: { value: ParticleShape; label: string }[] = [
  ...PARTICLE_SHAPES,
  { value: 'image', label: 'Image' },
]

/** Choix de la forme : une grille de pictogrammes plutôt qu'une rangée de mots. */
export function ShapePicker({ value, onChange }: { value: ParticleShape; onChange: (shape: ParticleShape) => void }) {
  return (
    <div className={styles.glyphGrid} role="radiogroup" aria-label="Forme des particules">
      {SHAPES.map(s => (
        <button
          key={s.value}
          type="button"
          role="radio"
          aria-checked={value === s.value}
          className={`${styles.glyph} ${value === s.value ? styles.glyphActive : ''}`}
          onClick={() => onChange(s.value)}
          title={s.label}
        >
          <ShapeGlyph shape={s.value} />
          <span className={styles.glyphLabel}>{s.label}</span>
        </button>
      ))}
    </div>
  )
}

/** Choix exclusif parmi plusieurs mots : des pastilles qui passent à la ligne. */
export function Chips<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div className={panel.familyChips} role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`${panel.familyChip} ${value === o.value ? panel.familyChipActive : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Image des particules : zone au thème (clic ou glisser-déposer), aperçu sur
 * fond sombre, et option pour teindre l'image aux couleurs des particules.
 */
export function ParticleImageField({ value, onPick }: {
  value: string | undefined
  onPick: (key: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const previewSrc = value?.startsWith('media/') ? resolveMedia(value) : value

  const take = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Ce fichier n’est pas une image.')
      return
    }
    setError(null)
    const bytes = new Uint8Array(await file.arrayBuffer())
    const key = generateMediaKey(file.name)
    registerMedia(key, bytes, file.type)
    onPick(key)
  }

  return (
    <div className={styles.imageField}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={e => {
          void take(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <button
        type="button"
        className={`${menu.mediaDrop} ${previewSrc ? styles.imageFilled : ''} ${dragging ? menu.mediaDragging : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => {
          if (!e.dataTransfer.types.includes('Files')) return
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          setDragging(false)
          if (e.dataTransfer.files.length === 0) return
          // Le dépôt ne doit pas atteindre l'éditeur (ouverture de projet, etc.).
          e.preventDefault()
          e.stopPropagation()
          void take(e.dataTransfer.files[0])
        }}
        aria-label={previewSrc ? "Remplacer l'image des particules" : "Choisir l'image des particules"}
      >
        {previewSrc ? (
          <>
            <span className={styles.imageStage}><img src={previewSrc} alt="" className={styles.imagePreview} /></span>
            <span className={styles.imageReplace}><Icon name="reload" size={13} /> Remplacer</span>
          </>
        ) : (
          <>
            <span className={menu.mediaIcon}><Icon name="image" size={20} /></span>
            <span className={menu.mediaTitle}>{dragging ? 'Déposez l’image' : 'Choisir une image'}</span>
            <span className={menu.mediaHint}>PNG transparent recommandé</span>
          </>
        )}
      </button>
      {error && <span className={menu.mediaError} role="alert">{error}</span>}
    </div>
  )
}
