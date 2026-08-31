import type { SlideBackground } from '../../types'
import { GRADIENT_PRESETS, DEFAULT_GRADIENT } from '../../ultra/SlideBackground'
import { generateMediaKey, registerMedia, resolveMedia } from '../../utils/mediaStore'
import styles from './PanelControls.module.css'

interface Props {
  slideIndex: number
  current: SlideBackground | undefined
  /** Dégradé et image ne sont proposés qu'en mode Ultra Design. */
  ultra: boolean
  onChange: (background: SlideBackground | undefined) => void
}

const TYPE_OPTIONS: { value: SlideBackground['type']; label: string; ultraOnly: boolean }[] = [
  { value: 'color', label: 'Couleur unie', ultraOnly: false },
  { value: 'gradient', label: 'Dégradé', ultraOnly: true },
  { value: 'image', label: 'Image', ultraOnly: true },
]

export default function BackgroundPanel({ slideIndex, current, ultra, onChange }: Props) {
  const hiddenUltra = !ultra && current && current.type !== 'color'

  const setType = (type: SlideBackground['type']) => {
    if (type === 'color') {
      onChange({ type: 'color', color: current?.color ?? '#1a1a2e' })
    } else if (type === 'gradient') {
      onChange({
        type: 'gradient',
        gradient: current?.gradient ?? { from: DEFAULT_GRADIENT.from, to: DEFAULT_GRADIENT.to, angle: DEFAULT_GRADIENT.angle },
        animated: current?.animated ?? false,
        overlay: current?.overlay,
      })
    } else {
      onChange({ type: 'image', image: current?.image, imageFit: current?.imageFit ?? 'cover', overlay: current?.overlay })
    }
  }

  const setOverlay = (changes: Partial<{ color: string; opacity: number }>) => {
    if (!current) return
    const overlay = { color: current.overlay?.color ?? '#000000', opacity: current.overlay?.opacity ?? 0.35, ...changes }
    onChange({ ...current, overlay })
  }

  const previewSrc = current?.type === 'image' && current.image
    ? (current.image.startsWith('media/') ? resolveMedia(current.image) : current.image)
    : undefined

  return (
    <>
      <p className={styles.groupLabel}>
        Diapositive {slideIndex + 1}
        {current && (
          <button className={styles.remove} onClick={() => onChange(undefined)}>
            retirer
          </button>
        )}
      </p>

      {hiddenUltra && (
        <p className={styles.hint}>
          « {current?.type === 'gradient' ? 'Dégradé' : 'Image'} » est un réglage Ultra : il est
          conservé mais reste inactif tant que le mode Ultra Design est coupé.
        </p>
      )}

      <div className={styles.group}>
        <div className={styles.presetList}>
          {TYPE_OPTIONS.filter(t => !t.ultraOnly || ultra || current?.type === t.value).map(t => (
            <button
              key={t.value}
              className={`${styles.preset} ${current?.type === t.value ? styles.presetActive : ''}`}
              onClick={() => setType(t.value)}
            >
              <span className={styles.presetName}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {current?.type === 'color' && (
        <div className={styles.group}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Couleur</span>
            <input
              type="color"
              className={styles.color}
              value={current.color ?? '#1a1a2e'}
              onChange={e => onChange({ ...current, color: e.target.value })}
            />
          </div>
        </div>
      )}

      {current?.type === 'gradient' && (
        <div className={styles.group}>
          <p className={styles.groupLabel}>Dégradé</p>
          <div className={styles.presetList}>
            {GRADIENT_PRESETS.map(p => {
              const active = current.gradient?.from === p.from && current.gradient?.to === p.to
              return (
                <button
                  key={p.label}
                  className={`${styles.preset} ${active ? styles.presetActive : ''}`}
                  onClick={() => onChange({ ...current, gradient: { from: p.from, to: p.to, angle: p.angle } })}
                  style={{ backgroundImage: `linear-gradient(${p.angle}deg, ${p.from}, ${p.to})`, color: '#fff' }}
                >
                  <span className={styles.presetName}>{p.label}</span>
                </button>
              )
            })}
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Départ</span>
            <input
              type="color"
              className={styles.color}
              value={current.gradient?.from ?? DEFAULT_GRADIENT.from}
              onChange={e => onChange({ ...current, gradient: { ...current.gradient!, from: e.target.value } })}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Arrivée</span>
            <input
              type="color"
              className={styles.color}
              value={current.gradient?.to ?? DEFAULT_GRADIENT.to}
              onChange={e => onChange({ ...current, gradient: { ...current.gradient!, to: e.target.value } })}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Angle</span>
            <input
              type="range"
              className={styles.range}
              min={0} max={360} step={15}
              value={current.gradient?.angle ?? DEFAULT_GRADIENT.angle}
              onChange={e => onChange({ ...current, gradient: { ...current.gradient!, angle: parseInt(e.target.value, 10) } })}
            />
          </div>

          <button
            className={`${styles.toggle} ${current.animated ? styles.toggleOn : ''}`}
            onClick={() => onChange({ ...current, animated: !current.animated })}
          >
            {current.animated ? '✓ Dégradé animé' : 'Animer le dégradé'}
          </button>
        </div>
      )}

      {current?.type === 'image' && (
        <div className={styles.group}>
          <p className={styles.groupLabel}>Image</p>
          {previewSrc && (
            <img
              src={previewSrc}
              style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', marginBottom: '0.5rem' }}
              alt=""
            />
          )}
          <input
            type="file"
            accept="image/*"
            className={styles.input}
            style={{ width: '100%', maxWidth: 'none' }}
            onChange={async e => {
              const file = e.target.files?.[0]
              if (!file) return
              const bytes = new Uint8Array(await file.arrayBuffer())
              const key = generateMediaKey(file.name)
              registerMedia(key, bytes, file.type)
              onChange({ ...current, image: key })
            }}
          />
          <div className={styles.field} style={{ marginTop: '0.5rem' }}>
            <span className={styles.fieldLabel}>Ajustement</span>
            <button
              className={styles.toggle}
              onClick={() => onChange({ ...current, imageFit: current.imageFit === 'contain' ? 'cover' : 'contain' })}
            >
              {current.imageFit === 'contain' ? 'Ajustée' : 'Recouvrante'}
            </button>
          </div>
        </div>
      )}

      {current && current.type !== 'color' && (
        <div className={styles.group}>
          <p className={styles.groupLabel}>Superposition</p>
          <p className={styles.subtle}>
            Assombrit ou éclaircit le fond pour garder le texte lisible.
          </p>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Couleur</span>
            <input
              type="color"
              className={styles.color}
              value={current.overlay?.color ?? '#000000'}
              onChange={e => setOverlay({ color: e.target.value })}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Intensité</span>
            <input
              type="range"
              className={styles.range}
              min={0} max={0.9} step={0.05}
              value={current.overlay?.opacity ?? 0}
              onChange={e => setOverlay({ opacity: parseFloat(e.target.value) })}
            />
          </div>
        </div>
      )}
    </>
  )
}