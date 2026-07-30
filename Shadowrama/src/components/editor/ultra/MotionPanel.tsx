import type { BlockData, MotionPhase, MotionSettings } from '../../../types'
import { presetsForPhase, presetDuration, getPreset } from '../../../ultra/presets'
import Icon from '../../ui/Icon'
import styles from '../PanelControls.module.css'

interface Props {
  block: BlockData | null
  onUpdate: (changes: (block: BlockData) => Partial<BlockData>) => void
  onGestureStart: () => void
  /** Joue la séquence sur le bloc, dans l'éditeur. */
  onPreview: (phase: MotionPhase) => void
}

const FAMILY_LABELS: Record<string, string> = {
  fondu: 'Fondus',
  glissement: 'Glissements',
  echelle: 'Échelle',
  rotation: 'Rotations',
  flou: 'Flous',
  texte: 'Texte découpé',
}

export default function MotionPanel({ block, onUpdate, onGestureStart, onPreview }: Props) {
  if (!block) {
    return (
      <p className={styles.hint}>
        Sélectionnez un bloc pour lui composer une séquence d'entrée et de sortie.
      </p>
    )
  }

  const motion = block.motion ?? {}

  const setPhase = (phase: MotionPhase, settings: MotionSettings | undefined) => {
    onGestureStart()
    onUpdate(current => ({ motion: { ...current.motion, [phase]: settings } }))
  }

  const patchPhase = (phase: MotionPhase, changes: Partial<MotionSettings>) => {
    const current = motion[phase]
    if (!current) return
    setPhase(phase, { ...current, ...changes })
  }

  const renderPhase = (phase: MotionPhase, title: string) => {
    const current = motion[phase]
    const preset = getPreset(current?.preset)
    const presets = presetsForPhase(phase)
    const byFamily = new Map<string, typeof presets>()
    for (const p of presets) {
      const list = byFamily.get(p.family) ?? []
      list.push(p)
      byFamily.set(p.family, list)
    }

    return (
      <div className={styles.group} key={phase}>
        <p className={styles.groupLabel}>
          {title}
          {current && (
            <button className={styles.remove} onClick={() => setPhase(phase, undefined)}>
              retirer
            </button>
          )}
        </p>

        {[...byFamily.entries()].map(([family, list]) => (
          <div key={family}>
            <p className={styles.family}>{FAMILY_LABELS[family] ?? family}</p>
            <div className={styles.presetList}>
              {list.map(p => {
                const active = current?.preset === p.id
                return (
                  <div
                    key={p.id}
                    className={`${styles.preset} ${active ? styles.presetActive : ''}`}
                    onClick={() => setPhase(phase, { preset: p.id, speed: current?.speed ?? 1, delay: current?.delay ?? 0 })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setPhase(phase, { preset: p.id, speed: 1, delay: 0 })
                      }
                    }}
                  >
                    <span className={styles.presetName}>{p.label}</span>
                    <button
                      className={styles.presetPlay}
                      title="Aperçu"
                      onClick={e => {
                        e.stopPropagation()
                        setPhase(phase, { preset: p.id, speed: current?.speed ?? 1, delay: current?.delay ?? 0 })
                        // Laisse le temps à la mise à jour d'atteindre le canvas.
                        setTimeout(() => onPreview(phase), 40)
                      }}
                    >
                      <Icon name="play" size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {current && preset && (
          <>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Vitesse</span>
              <input
                type="range"
                className={styles.range}
                min={0.25} max={3} step={0.25}
                value={current.speed ?? 1}
                onChange={e => patchPhase(phase, { speed: parseFloat(e.target.value) })}
              />
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Délai (s)</span>
              <input
                type="number"
                className={styles.input}
                min={0} max={10} step={0.1}
                value={current.delay ?? 0}
                onChange={e => patchPhase(phase, { delay: parseFloat(e.target.value) || 0 })}
              />
            </div>
            {preset.split && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Cascade (s)</span>
                <input
                  type="number"
                  className={styles.input}
                  min={0} max={0.5} step={0.005}
                  value={current.stagger ?? (preset.split === 'chars' ? 0.035 : 0.09)}
                  onChange={e => patchPhase(phase, { stagger: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}
            <div className={styles.field}>
              <span className={styles.fieldLabel}>
                Durée totale : {presetDuration(preset, current.speed ?? 1).toFixed(2)} s
              </span>
              <button className={styles.presetPlay} title="Aperçu" onClick={() => onPreview(phase)}>
                <Icon name="play" size={12} />
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      {renderPhase('in', 'Entrée')}
      {renderPhase('out', 'Sortie')}
    </>
  )
}
