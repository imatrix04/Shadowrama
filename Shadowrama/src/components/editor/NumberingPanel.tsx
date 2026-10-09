import type { Keyframe, NumberingAnimation, NumberingPosition, SlideNumbering } from '../../types'
import { presetsForPhase, presetDuration, getPreset } from '../../ultra/presets'
import { previewStyle } from '../../ultra/presetPreview'
import CustomSelect from '../../styles/CustomSelect'
import Switch from '../ui/Switch'
import Icon from '../ui/Icon'
import {
  COUNT_PRESET, CUSTOM_PRESET, DEFAULT_CUSTOM_MOTION, NUMBERING_EASES,
  NUMBERING_FORMATS, NUMBERING_POSITIONS, POSITION_LABELS,
} from '../../utils/numbering'
import styles from './PanelControls.module.css'
import local from './NumberingPanel.module.css'

interface Props {
  numbering: SlideNumbering
  /** L'animation du numéro n'est proposée qu'en mode Ultra Design. */
  ultra: boolean
  onChange: (numbering: SlideNumbering) => void
  /** Joue l'animation du numéro sur la diapositive affichée. */
  onPreview: () => void
}

const FAMILY_LABELS: Record<string, string> = {
  fondu: 'Fondus',
  glissement: 'Glissements',
  echelle: 'Échelle',
  rotation: 'Rotations',
  flou: 'Flous',
  texte: 'Texte découpé',
}

function dotClass(position: NumberingPosition): string {
  if (position.endsWith('left')) return local.dotLeft
  if (position.endsWith('right')) return local.dotRight
  return local.dotCenter
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format?: (value: number) => string
  onChange: (value: number) => void
}

function Slider({ label, value, min, max, step, format, onChange }: SliderProps) {
  return (
    <div className={styles.fieldStacked}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.rangeGroup}>
        <input
          type="range"
          className={styles.range}
          min={min} max={max} step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
        />
        <span className={styles.rangeValue}>{format ? format(value) : value}</span>
      </div>
    </div>
  )
}

export default function NumberingPanel({ numbering, ultra, onChange, onPreview }: Props) {
  const patch = (changes: Partial<SlideNumbering>) => onChange({ ...numbering, ...changes })

  const animation = numbering.animation
  const preset = getPreset(animation?.preset)
  const isCount = animation?.preset === COUNT_PRESET
  const isCustom = animation?.preset === CUSTOM_PRESET
  const custom = animation?.custom ?? DEFAULT_CUSTOM_MOTION

  const setAnimation = (next: NumberingAnimation | undefined) => patch({ animation: next })

  const choose = (id: string | undefined) => {
    if (!id) {
      setAnimation(undefined)
      return
    }
    setAnimation({ ...animation, preset: id })
    // Laisse la mise à jour atteindre le canvas avant de jouer l'aperçu.
    setTimeout(onPreview, 40)
  }

  const patchCustom = (changes: Partial<typeof custom>) =>
    setAnimation({ preset: CUSTOM_PRESET, ...animation, custom: { ...custom, ...changes } })

  const patchFrom = (changes: Keyframe) => patchCustom({ from: { ...custom.from, ...changes } })

  const basicPresets = presetsForPhase('in', true).filter(p => p.tier === 'basic')
  const ultraPresets = presetsForPhase('in', true).filter(p => p.tier === 'ultra')

  const card = (id: string, label: string, active: boolean, style?: React.CSSProperties, isUltra = true) => (
    <div
      key={id}
      className={[styles.preset, isUltra ? styles.presetUltra : '', active ? styles.presetActive : ''].join(' ')}
      style={style}
      role="button"
      tabIndex={0}
      onClick={() => choose(id)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          choose(id)
        }
      }}
    >
      <span className={styles.motionPreview}>
        <span className={styles.motionChip} />
      </span>
      <span className={styles.presetName}>{label}</span>
    </div>
  )

  return (
    <>
      <div className={styles.group}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Numéroter les diapositives</span>
          <Switch
            checked={numbering.enabled}
            onChange={enabled => patch({ enabled })}
            label="Numéroter les diapositives"
          />
        </div>
        {!numbering.enabled && (
          <p className={styles.subtle}>
            Ajoute automatiquement le numéro de chaque diapositive, dans l'éditeur et en présentation.
          </p>
        )}
      </div>

      {numbering.enabled && (
        <>
          <div className={styles.group}>
            <p className={styles.groupLabel}>Apparence</p>

            <div className={styles.fieldStacked}>
              <span className={styles.fieldLabel}>Format</span>
              <CustomSelect
                value={numbering.format}
                options={NUMBERING_FORMATS}
                onChange={format => patch({ format: format as SlideNumbering['format'] })}
              />
            </div>

            <span className={styles.fieldLabel}>Position</span>
            <div className={local.positions}>
              {NUMBERING_POSITIONS.map(position => (
                <button
                  key={position}
                  type="button"
                  title={POSITION_LABELS[position]}
                  aria-label={POSITION_LABELS[position]}
                  aria-pressed={numbering.position === position}
                  className={`${local.pos} ${numbering.position === position ? local.posActive : ''}`}
                  style={{ display: 'flex', alignItems: position.startsWith('top') ? 'flex-start' : 'flex-end', padding: 4 }}
                  onClick={() => patch({ position })}
                >
                  <span className={`${local.dot} ${dotClass(position)}`} />
                </button>
              ))}
            </div>

            <Slider
              label="Taille"
              value={numbering.size} min={10} max={72} step={1}
              format={v => `${v}px`}
              onChange={size => patch({ size })}
            />
            <Slider
              label="Opacité"
              value={numbering.opacity} min={0.1} max={1} step={0.05}
              format={v => `${Math.round(v * 100)}%`}
              onChange={opacity => patch({ opacity })}
            />

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Gras</span>
              <Switch checked={numbering.bold} onChange={bold => patch({ bold })} label="Gras" />
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Couleur automatique</span>
              <Switch
                checked={numbering.color === undefined}
                onChange={auto => patch({ color: auto ? undefined : '#ffffff' })}
                label="Couleur automatique"
              />
            </div>
            {numbering.color !== undefined && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Couleur</span>
                <input
                  type="color"
                  className={styles.color}
                  value={numbering.color}
                  onChange={e => patch({ color: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className={styles.group}>
            <p className={styles.groupLabel}>Numérotation</p>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Commencer à</span>
              <input
                type="number"
                className={styles.input}
                min={0} max={9999} step={1}
                value={numbering.startAt}
                onChange={e => {
                  const value = Math.round(parseFloat(e.target.value))
                  patch({ startAt: Number.isFinite(value) ? Math.min(9999, Math.max(0, value)) : 0 })
                }}
              />
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Masquer sur la 1re diapo</span>
              <Switch
                checked={numbering.skipFirst}
                onChange={skipFirst => patch({ skipFirst })}
                label="Masquer sur la première diapositive"
              />
            </div>
          </div>

          <div className={`${styles.group} ${styles.phaseCard}`}>
            <p className={styles.groupLabel}>
              Animation
              {animation && ultra && (
                <button className={styles.remove} onClick={() => choose(undefined)}>retirer</button>
              )}
            </p>

            {!ultra && (
              <p className={styles.hint}>
                {animation
                  ? 'Une animation est enregistrée : elle reste inactive tant que le mode Ultra Design est coupé.'
                  : "L'animation du numéro (presets, compteur, mode manuel) fait partie du mode Ultra Design."}
              </p>
            )}

            {ultra && (
              <>
                <p className={styles.family}>Spéciaux</p>
                <div className={styles.presetList}>
                  {card(COUNT_PRESET, 'Compteur', isCount)}
                  {card(CUSTOM_PRESET, 'Manuel', isCustom)}
                </div>

                <p className={styles.family}>Classiques</p>
                <div className={styles.presetList}>
                  {basicPresets.map(p => card(p.id, p.label, animation?.preset === p.id, previewStyle(p), false))}
                </div>

                <p className={styles.familyUltra}>
                  <Icon name="ultra" size={11} />
                  Ultra
                </p>
                {[...new Set(ultraPresets.map(p => p.family))].map(family => (
                  <div key={family}>
                    <p className={styles.subFamily}>{FAMILY_LABELS[family] ?? family}</p>
                    <div className={styles.presetList}>
                      {ultraPresets
                        .filter(p => p.family === family)
                        .map(p => card(p.id, p.label, animation?.preset === p.id, previewStyle(p)))}
                    </div>
                  </div>
                ))}

                {animation && (
                  <>
                    <hr className={local.separator} />
                    <Slider
                      label="Vitesse"
                      value={animation.speed ?? 1} min={0.25} max={3} step={0.25}
                      format={v => `${v}×`}
                      onChange={speed => setAnimation({ ...animation, speed })}
                    />
                    <div className={styles.field}>
                      <span className={styles.fieldLabel}>Délai (s)</span>
                      <input
                        type="number"
                        className={styles.input}
                        min={0} max={10} step={0.1}
                        value={animation.delay ?? 0}
                        onChange={e => setAnimation({ ...animation, delay: Math.max(0, parseFloat(e.target.value) || 0) })}
                      />
                    </div>
                    {preset && (
                      <p className={styles.subtle}>
                        Durée : {presetDuration(preset, animation.speed ?? 1).toFixed(2)} s
                      </p>
                    )}
                  </>
                )}

                {isCustom && (
                  <>
                    <hr className={local.separator} />
                    <p className={styles.subtle}>
                      Réglez la pose de départ : le numéro la quitte pour rejoindre sa place.
                    </p>
                    <Slider
                      label="Opacité de départ"
                      value={custom.from.opacity ?? 1} min={0} max={1} step={0.05}
                      format={v => `${Math.round(v * 100)}%`}
                      onChange={opacity => patchFrom({ opacity })}
                    />
                    <Slider
                      label="Décalage horizontal"
                      value={custom.from.x ?? 0} min={-200} max={200} step={2}
                      format={v => `${v}px`}
                      onChange={x => patchFrom({ x })}
                    />
                    <Slider
                      label="Décalage vertical"
                      value={custom.from.y ?? 0} min={-200} max={200} step={2}
                      format={v => `${v}px`}
                      onChange={y => patchFrom({ y })}
                    />
                    <Slider
                      label="Échelle de départ"
                      value={custom.from.scale ?? 1} min={0} max={3} step={0.05}
                      format={v => `${v.toFixed(2)}×`}
                      onChange={scale => patchFrom({ scale })}
                    />
                    <Slider
                      label="Rotation de départ"
                      value={custom.from.rotate ?? 0} min={-360} max={360} step={5}
                      format={v => `${v}°`}
                      onChange={rotate => patchFrom({ rotate })}
                    />
                    <Slider
                      label="Flou de départ"
                      value={custom.from.blur ?? 0} min={0} max={30} step={1}
                      format={v => `${v}px`}
                      onChange={blur => patchFrom({ blur })}
                    />
                    <Slider
                      label="Durée"
                      value={custom.duration} min={0.1} max={3} step={0.1}
                      format={v => `${v.toFixed(1)} s`}
                      onChange={duration => patchCustom({ duration })}
                    />
                    <div className={styles.fieldStacked}>
                      <span className={styles.fieldLabel}>Courbe</span>
                      <CustomSelect
                        value={custom.ease}
                        options={NUMBERING_EASES}
                        onChange={ease => patchCustom({ ease })}
                      />
                    </div>
                  </>
                )}

                {animation && (
                  <div className={local.previewRow}>
                    <button className={styles.presetPlay} title="Aperçu" onClick={onPreview}>
                      <Icon name="play" size={12} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}