import { useState } from 'react'
import type { ReactNode } from 'react'
import type { BlockData, BlockEffects, Glass } from '../../../types'
import ColorPicker from '../../ui/ColorPicker'
import { resolveGlass, glassStyle } from '../../../ultra/effectStyle'
import glassCss from '../../../ultra/Glass.module.css'
import { Section, SwitchRow } from '../PanelWidgets'
import EffectIcon from './EffectIcon'
import type { EffectKey } from './EffectIcon'
import styles from '../PanelControls.module.css'

interface Props {
  block: BlockData | null
  onUpdate: (changes: (block: BlockData) => Partial<BlockData>) => void
  onGestureStart: () => void
}

const DEFAULTS = {
  shadow: { x: 0, y: 12, blur: 28, color: '#000000' },
  glow: { blur: 18, color: '#6c63ff' },
  glass: { blur: 16, tint: '#ffffff', opacity: 0.12, radius: 16, reactive: true, saturate: 160, border: 0.28, grain: 0.1, sheen: 1, tilt: 0, shine: false },
  gradient: { from: '#6c63ff', to: '#ff6bd6', angle: 135 },
  corners: { tl: 24, tr: 4, br: 24, bl: 4 },
  textStroke: { width: 1, color: '#ffffff' },
  float: { amplitude: 10, duration: 3.4 },
} as const

type ToggleKey = keyof typeof DEFAULTS

/** Préréglages de verre : un point de départ complet, ajustable ensuite. */
const GLASS_PRESETS: { id: string; label: string; glass: Glass }[] = [
  { id: 'frost', label: 'Givré', glass: { blur: 18, tint: '#ffffff', opacity: 0.14, radius: 16, reactive: true, saturate: 160, border: 0.3, grain: 0.18, sheen: 1, tilt: 0, shine: false } },
  { id: 'crystal', label: 'Cristal', glass: { blur: 6, tint: '#ffffff', opacity: 0.05, radius: 20, reactive: true, saturate: 190, border: 0.55, grain: 0, sheen: 1, tilt: 0, shine: true } },
  { id: 'smoke', label: 'Fumé', glass: { blur: 22, tint: '#0b0c18', opacity: 0.5, radius: 14, reactive: true, saturate: 140, border: 0.16, grain: 0.1, sheen: 0.6, tilt: 0, shine: false } },
  { id: 'aurora', label: 'Aurore', glass: { blur: 24, tint: '#7c6cff', tint2: '#ff6bd6', opacity: 0.24, radius: 22, reactive: true, saturate: 190, border: 0.38, grain: 0.06, sheen: 1, tilt: 0, shine: true } },
  { id: 'liquid', label: 'Liquide', glass: { blur: 12, tint: '#ffffff', opacity: 0.08, radius: 28, reactive: true, saturate: 210, border: 0.6, grain: 0, sheen: 1, tilt: 8, shine: false } },
]

const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'difference', 'exclusion', 'luminosity'] as const

const EFFECTS: { key: EffectKey; label: string; textOnly?: boolean }[] = [
  { key: 'shadow', label: 'Ombre' },
  { key: 'glow', label: 'Lueur' },
  { key: 'glass', label: 'Verre' },
  { key: 'float', label: 'Flottement' },
  { key: 'gradient', label: 'Dégradé' },
  { key: 'corners', label: 'Arrondi' },
  { key: 'textStroke', label: 'Contour', textOnly: true },
  { key: 'filters', label: 'Filtres' },
]

/** Un effet est « actif » dès qu'il modifie le rendu du bloc. */
function isActive(fx: BlockEffects, key: EffectKey): boolean {
  if (key === 'filters') {
    return !!fx.blur
      || (fx.brightness !== undefined && fx.brightness !== 1)
      || (fx.saturate !== undefined && fx.saturate !== 1)
      || (fx.contrast !== undefined && fx.contrast !== 1)
      || (fx.blendMode !== undefined && fx.blendMode !== 'normal')
  }
  return !!fx[key]
}

export default function EffectsPanel({ block, onUpdate, onGestureStart }: Props) {
  const [selectedKey, setSelectedKey] = useState<EffectKey | null>(null)

  if (!block) {
    return <p className={styles.hint}>Sélectionnez un bloc pour lui appliquer des effets.</p>
  }

  const fx: BlockEffects = block.effects ?? {}
  const isText = block.type === 'text' || block.type === 'title'
  const available = EFFECTS.filter(e => !e.textOnly || isText)
  // Le bloc sélectionné a pu changer : on ne garde que ce qui existe pour lui.
  const selected = available.some(e => e.key === selectedKey) ? selectedKey : null

  // Lit les effets à jour au moment de l'application, pas ceux du rendu :
  // deux réglages enchaînés rapidement ne s'écrasent plus.
  const patch = (changes: Partial<BlockEffects>) => {
    onGestureStart()
    onUpdate(current => ({ effects: { ...current.effects, ...changes } }))
  }

  const setEffect = <K extends ToggleKey>(key: K, on: boolean) => {
    onGestureStart()
    onUpdate(current => ({
      effects: { ...current.effects, [key]: on ? { ...DEFAULTS[key] } : undefined },
    }))
  }

  /**
   * Clic sur une icône, comme un interrupteur à deux temps :
   * - effet inactif : on l'active et on affiche ses réglages ;
   * - effet actif mais pas affiché : on affiche ses réglages (sans le couper,
   *   on veut juste le modifier) ;
   * - effet actif et déjà affiché : on le désactive.
   */
  const pick = (key: EffectKey) => {
    const active = isActive(fx, key)
    if (!active) {
      setSelectedKey(key)
      if (key !== 'filters') setEffect(key, true)
    } else if (selected !== key) {
      setSelectedKey(key)
    } else if (key === 'filters') {
      patch({ blur: undefined, brightness: undefined, saturate: undefined, contrast: undefined, blendMode: undefined })
    } else {
      setEffect(key, false)
    }
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
      <ColorPicker value={value} onChange={v => onChange(v)} />
    </div>
  )

  const slider = (
    label: string, value: number, onChange: (v: number) => void,
    min: number, max: number, step: number, unit = '',
  ) => (
    <div className={styles.fieldStacked}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.rangeGroup}>
        <input
          type="range"
          className={styles.range}
          min={min} max={max} step={step}
          value={value}
          aria-label={label}
          onChange={e => onChange(parseFloat(e.target.value))}
        />
        <span className={styles.rangeValue}>{step < 1 ? value.toFixed(2) : value}{unit}</span>
      </div>
    </div>
  )

  const renderGlass = (glass: Glass) => {
    const g = resolveGlass(glass)
    const set = (changes: Partial<Glass>) => patch({ glass: { ...glass, ...changes } })
    const num = (key: keyof Glass) => (v: number) => set({ [key]: v })
    return (
      <>
        {/* Préréglages : chaque tuile montre le verre posé sur un fond coloré. */}
        <div className={styles.glassTiles} role="group" aria-label="Préréglages de verre">
          {GLASS_PRESETS.map(p => (
            <button
              key={p.id}
              type="button"
              className={styles.glassTile}
              onClick={() => set({ ...p.glass, tint2: p.glass.tint2 })}
            >
              <span className={styles.glassTileBackdrop}>
                <span className={`${styles.glassTileSample} ${glassCss.glass}`} style={glassStyle({ ...p.glass, blur: Math.min(p.glass.blur, 8) })} />
              </span>
              <span className={styles.glassTileLabel}>{p.label}</span>
            </button>
          ))}
        </div>

        {/* L'essentiel : ce qu'on retouche presque à chaque fois. */}
        {slider('Flou', g.blur, num('blur'), 0, 60, 1, ' px')}
        {slider('Opacité', g.opacity, num('opacity'), 0, 1, 0.02)}
        {colorField('Teinte', g.tint, v => set({ tint: v }))}

        <Section title="Matière">
          {slider('Saturation', g.saturate, num('saturate'), 50, 300, 5, ' %')}
          {slider('Liseré lumineux', g.border, num('border'), 0, 1, 0.02)}
          {slider('Grain de givre', g.grain, num('grain'), 0, 1, 0.02)}
          {slider('Arrondi', g.radius, num('radius'), 0, 120, 1, ' px')}
          <SwitchRow
            label="Dégradé de teinte"
            checked={g.tint2 !== undefined}
            onChange={on => set({ tint2: on ? '#ff6bd6' : undefined })}
          />
          {g.tint2 !== undefined && colorField('Teinte 2', g.tint2, v => set({ tint2: v }))}
        </Section>

        <Section title="Animation">
          <SwitchRow label="Balayage lumineux" checked={g.shine} onChange={on => set({ shine: on })} />
          <SwitchRow label="Réactif à la souris" checked={g.reactive} onChange={on => set({ reactive: on })} />
          {g.reactive && (
            <>
              {slider('Reflet', g.sheen, num('sheen'), 0, 1, 0.05)}
              {slider('Inclinaison 3D', g.tilt, num('tilt'), 0, 20, 1, '°')}
            </>
          )}
        </Section>

        <p className={styles.hint}>Le verre floute ce qui est derrière lui : placez-le devant une image ou un fond coloré.</p>
      </>
    )
  }

  /** Réglages de l'effet choisi (hors interrupteur, géré par `renderDetail`). */
  const renderControls = (key: EffectKey): ReactNode => {
    switch (key) {
      case 'shadow': {
        const s = fx.shadow
        if (!s) return null
        return (
          <>
            {numberField('Décalage X', s.x, v => patch({ shadow: { ...s, x: v } }), { min: -100, max: 100 })}
            {numberField('Décalage Y', s.y, v => patch({ shadow: { ...s, y: v } }), { min: -100, max: 100 })}
            {numberField('Flou', s.blur, v => patch({ shadow: { ...s, blur: v } }), { min: 0, max: 120 })}
            {colorField('Couleur', s.color, v => patch({ shadow: { ...s, color: v } }))}
          </>
        )
      }
      case 'glow': {
        const gl = fx.glow
        if (!gl) return null
        return (
          <>
            {numberField('Intensité', gl.blur, v => patch({ glow: { ...gl, blur: v } }), { min: 0, max: 80 })}
            {colorField('Couleur', gl.color, v => patch({ glow: { ...gl, color: v } }))}
          </>
        )
      }
      case 'glass':
        return fx.glass ? renderGlass(fx.glass) : null
      case 'float': {
        const f = fx.float
        if (!f) return null
        return (
          <>
            {numberField('Amplitude (px)', f.amplitude, v => patch({ float: { ...f, amplitude: v } }), { min: 2, max: 60 })}
            {numberField('Durée du cycle (s)', f.duration, v => patch({ float: { ...f, duration: v } }), { min: 1, max: 10, step: 0.1 })}
            <p className={styles.hint}>Flotte en boucle et s'élève un peu plus au survol de la souris.</p>
          </>
        )
      }
      case 'gradient': {
        const gr = fx.gradient
        if (!gr) return null
        return (
          <>
            {colorField('Départ', gr.from, v => patch({ gradient: { ...gr, from: v } }))}
            {colorField('Arrivée', gr.to, v => patch({ gradient: { ...gr, to: v } }))}
            {numberField('Angle', gr.angle, v => patch({ gradient: { ...gr, angle: v } }), { min: 0, max: 360, step: 5 })}
            {(block.type === 'image' || block.type === 'video') && (
              <p className={styles.hint}>Le dégradé ne s'applique pas aux images ni aux vidéos.</p>
            )}
          </>
        )
      }
      case 'corners': {
        const c = fx.corners
        if (!c) return null
        return (
          <>
            {numberField('Haut gauche', c.tl, v => patch({ corners: { ...c, tl: v } }), { min: 0, max: 200 })}
            {numberField('Haut droit', c.tr, v => patch({ corners: { ...c, tr: v } }), { min: 0, max: 200 })}
            {numberField('Bas droit', c.br, v => patch({ corners: { ...c, br: v } }), { min: 0, max: 200 })}
            {numberField('Bas gauche', c.bl, v => patch({ corners: { ...c, bl: v } }), { min: 0, max: 200 })}
          </>
        )
      }
      case 'textStroke': {
        const t = fx.textStroke
        if (!t) return null
        return (
          <>
            {numberField('Épaisseur', t.width, v => patch({ textStroke: { ...t, width: v } }), { min: 0, max: 10, step: 0.5 })}
            {colorField('Couleur', t.color, v => patch({ textStroke: { ...t, color: v } }))}
          </>
        )
      }
      case 'filters':
        return (
          <>
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
          </>
        )
    }
  }

  const renderDetail = (key: EffectKey) => {
    const meta = EFFECTS.find(e => e.key === key)!
    // Les filtres n'ont pas d'état « activé » : ils agissent dès qu'on les règle.
    if (key === 'filters') return <div className={styles.effectDetail}>{renderControls(key)}</div>
    const on = !!fx[key]
    return (
      <div className={styles.effectDetail}>
        <SwitchRow label={meta.label} checked={on} onChange={v => setEffect(key, v)} />
        {on ? renderControls(key) : <p className={styles.hint}>Effet désactivé.</p>}
      </div>
    )
  }

  return (
    <>
      <div className={styles.effectGrid} role="group" aria-label="Effets">
        {available.map(({ key, label }) => {
          const active = isActive(fx, key)
          return (
            <button
              key={key}
              type="button"
              className={`${styles.effectTile} ${selected === key ? styles.effectTileSelected : ''}`}
              onClick={() => pick(key)}
              aria-pressed={selected === key}
              title={active ? `${label} (actif)` : label}
            >
              <EffectIcon name={key} />
              <span className={styles.effectTileLabel}>{label}</span>
              {active && <span className={styles.effectTileDot} aria-label="actif" />}
            </button>
          )
        })}
      </div>

      {selected
        ? renderDetail(selected)
        : <p className={styles.hint}>Choisissez un effet pour le régler. Un point indique ceux qui sont déjà actifs.</p>}
    </>
  )
}
