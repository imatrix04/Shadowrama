import type { BlockData, BlockEffects } from '../../../types'
import styles from './UltraPanels.module.css'

interface Props {
  block: BlockData | null
  onUpdate: (changes: (block: BlockData) => Partial<BlockData>) => void
  onGestureStart: () => void
}

const DEFAULTS = {
  shadow: { x: 0, y: 12, blur: 28, color: '#000000' },
  glow: { blur: 18, color: '#6c63ff' },
  gradient: { from: '#6c63ff', to: '#ff6bd6', angle: 135 },
  corners: { tl: 24, tr: 4, br: 24, bl: 4 },
  textStroke: { width: 1, color: '#ffffff' },
} as const

const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'difference', 'exclusion', 'luminosity'] as const

export default function EffectsPanel({ block, onUpdate, onGestureStart }: Props) {
  if (!block) {
    return <p className={styles.hint}>Sélectionnez un bloc pour lui appliquer des effets.</p>
  }

  const fx: BlockEffects = block.effects ?? {}

  // Lit les effets à jour au moment de l'application, pas ceux du rendu :
  // deux réglages enchaînés rapidement ne s'écrasent plus.
  const patch = (changes: Partial<BlockEffects>) => {
    onGestureStart()
    onUpdate(current => ({ effects: { ...current.effects, ...changes } }))
  }

  /** Active ou désactive un effet composé, en repartant de valeurs parlantes. */
  const toggle = <K extends keyof typeof DEFAULTS>(key: K) => {
    onGestureStart()
    onUpdate(current => ({
      effects: {
        ...current.effects,
        [key]: current.effects?.[key] ? undefined : { ...DEFAULTS[key] },
      },
    }))
  }

  const numberField = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    opts: { min?: number; max?: number; step?: number } = {},
  ) => (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        type="number"
        className={styles.input}
        value={value}
        min={opts.min} max={opts.max} step={opts.step ?? 1}
        onChange={e => {
          const parsed = parseFloat(e.target.value)
          onChange(Number.isNaN(parsed) ? 0 : parsed)
        }}
      />
    </div>
  )

  const colorField = (label: string, value: string, onChange: (v: string) => void) => (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input type="color" className={styles.color} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )

  return (
    <>
      {/* ── Ombre ── */}
      <div className={styles.group}>
        <button
          className={`${styles.toggle} ${fx.shadow ? styles.toggleOn : ''}`}
          onClick={() => toggle('shadow')}
        >
          {fx.shadow ? '✓ Ombre portée' : '+ Ombre portée'}
        </button>
        {fx.shadow && (
          <>
            {numberField('Décalage X', fx.shadow.x, v => patch({ shadow: { ...fx.shadow!, x: v } }), { min: -100, max: 100 })}
            {numberField('Décalage Y', fx.shadow.y, v => patch({ shadow: { ...fx.shadow!, y: v } }), { min: -100, max: 100 })}
            {numberField('Flou', fx.shadow.blur, v => patch({ shadow: { ...fx.shadow!, blur: v } }), { min: 0, max: 120 })}
            {colorField('Couleur', fx.shadow.color, v => patch({ shadow: { ...fx.shadow!, color: v } }))}
          </>
        )}
      </div>

      {/* ── Lueur ── */}
      <div className={styles.group}>
        <button
          className={`${styles.toggle} ${fx.glow ? styles.toggleOn : ''}`}
          onClick={() => toggle('glow')}
        >
          {fx.glow ? '✓ Lueur' : '+ Lueur'}
        </button>
        {fx.glow && (
          <>
            {numberField('Intensité', fx.glow.blur, v => patch({ glow: { ...fx.glow!, blur: v } }), { min: 0, max: 80 })}
            {colorField('Couleur', fx.glow.color, v => patch({ glow: { ...fx.glow!, color: v } }))}
          </>
        )}
      </div>

      {/* ── Dégradé ── */}
      <div className={styles.group}>
        <button
          className={`${styles.toggle} ${fx.gradient ? styles.toggleOn : ''}`}
          onClick={() => toggle('gradient')}
        >
          {fx.gradient ? '✓ Dégradé' : '+ Dégradé'}
        </button>
        {fx.gradient && (
          <>
            {colorField('Départ', fx.gradient.from, v => patch({ gradient: { ...fx.gradient!, from: v } }))}
            {colorField('Arrivée', fx.gradient.to, v => patch({ gradient: { ...fx.gradient!, to: v } }))}
            {numberField('Angle', fx.gradient.angle, v => patch({ gradient: { ...fx.gradient!, angle: v } }), { min: 0, max: 360, step: 5 })}
            {block.type === 'image' && (
              <p className={styles.hint}>Le dégradé ne s'applique pas aux images.</p>
            )}
          </>
        )}
      </div>

      {/* ── Arrondi par coin ── */}
      <div className={styles.group}>
        <button
          className={`${styles.toggle} ${fx.corners ? styles.toggleOn : ''}`}
          onClick={() => toggle('corners')}
        >
          {fx.corners ? '✓ Arrondi par coin' : '+ Arrondi par coin'}
        </button>
        {fx.corners && (
          <>
            {numberField('Haut gauche', fx.corners.tl, v => patch({ corners: { ...fx.corners!, tl: v } }), { min: 0, max: 200 })}
            {numberField('Haut droit', fx.corners.tr, v => patch({ corners: { ...fx.corners!, tr: v } }), { min: 0, max: 200 })}
            {numberField('Bas droit', fx.corners.br, v => patch({ corners: { ...fx.corners!, br: v } }), { min: 0, max: 200 })}
            {numberField('Bas gauche', fx.corners.bl, v => patch({ corners: { ...fx.corners!, bl: v } }), { min: 0, max: 200 })}
          </>
        )}
      </div>

      {/* ── Contour de texte ── */}
      {(block.type === 'text' || block.type === 'title') && (
        <div className={styles.group}>
          <button
            className={`${styles.toggle} ${fx.textStroke ? styles.toggleOn : ''}`}
            onClick={() => toggle('textStroke')}
          >
            {fx.textStroke ? '✓ Contour de texte' : '+ Contour de texte'}
          </button>
          {fx.textStroke && (
            <>
              {numberField('Épaisseur', fx.textStroke.width, v => patch({ textStroke: { ...fx.textStroke!, width: v } }), { min: 0, max: 10, step: 0.5 })}
              {colorField('Couleur', fx.textStroke.color, v => patch({ textStroke: { ...fx.textStroke!, color: v } }))}
            </>
          )}
        </div>
      )}

      {/* ── Filtres ── */}
      <div className={styles.group}>
        <p className={styles.groupLabel}>Filtres</p>
        {numberField('Flou', fx.blur ?? 0, v => patch({ blur: v || undefined }), { min: 0, max: 40 })}
        {numberField('Luminosité', fx.brightness ?? 1, v => patch({ brightness: v }), { min: 0, max: 3, step: 0.05 })}
        {numberField('Saturation', fx.saturate ?? 1, v => patch({ saturate: v }), { min: 0, max: 3, step: 0.05 })}
        {numberField('Contraste', fx.contrast ?? 1, v => patch({ contrast: v }), { min: 0, max: 3, step: 0.05 })}
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Fusion</span>
          <select
            className={styles.input}
            value={fx.blendMode ?? 'normal'}
            onChange={e => patch({ blendMode: e.target.value as BlockEffects['blendMode'] })}
          >
            {BLEND_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
    </>
  )
}
