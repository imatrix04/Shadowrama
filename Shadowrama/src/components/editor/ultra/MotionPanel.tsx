import { useState } from 'react'
import type { BlockData, MotionPhase, MotionPreset, MotionSettings } from '../../../types'
import { presetsForPhase, presetDuration, getPreset } from '../../../ultra/presets'
import { previewStyle } from '../../../ultra/presetPreview'
import Icon from '../../ui/Icon'
import styles from '../PanelControls.module.css'

interface Props {
  block: BlockData | null
  /** Filtre les presets Ultra de la liste ; les presets `basic` restent
   *  toujours proposés (voir presets.ts). */
  ultra: boolean
  onUpdate: (changes: (block: BlockData) => Partial<BlockData>) => void
  onGestureStart: () => void
  /** Joue la séquence sur le bloc, dans l'éditeur. */
  onPreview: (phase: MotionPhase) => void
}

const PHASES: { value: MotionPhase; label: string; hint: string }[] = [
  { value: 'in', label: 'Entrée', hint: "Comment le bloc apparaît" },
  { value: 'out', label: 'Sortie', hint: 'Comment le bloc disparaît' },
]

const FAMILY_ORDER = ['fondu', 'glissement', 'echelle', 'rotation', 'flou', 'texte']

const FAMILY_LABELS: Record<string, string> = {
  fondu: 'Fondu',
  glissement: 'Glissement',
  echelle: 'Échelle',
  rotation: 'Rotation',
  flou: 'Flou',
  texte: 'Texte',
}

const MIN_DURATION = 0.2
const MAX_DURATION = 4

export default function MotionPanel({ block, ultra, onUpdate, onGestureStart, onPreview }: Props) {
  const [phase, setPhase] = useState<MotionPhase>('in')
  // Famille choisie à la main, par phase ; à défaut, celle du mouvement posé.
  const [chosenFamily, setChosenFamily] = useState<Partial<Record<MotionPhase, string>>>({})

  if (!block) {
    return (
      <p className={styles.hint}>
        Sélectionnez un bloc pour lui composer une séquence d'entrée et de sortie.
      </p>
    )
  }

  const motion = block.motion ?? {}
  const current = motion[phase]
  const preset = getPreset(current?.preset)
  const presets = presetsForPhase(phase, ultra)

  // Une séquence Ultra posée puis le mode coupé : elle reste enregistrée
  // mais n'apparaît plus dans la grille ci-dessous.
  const hiddenUltra = !ultra && preset?.tier === 'ultra'

  const families = FAMILY_ORDER.filter(f => presets.some(p => p.family === f))
  const family = [chosenFamily[phase], preset?.family, families[0]]
    .find((f): f is string => !!f && families.includes(f))
  const visible = presets.filter(p => p.family === family)

  const setMotion = (target: MotionPhase, settings: MotionSettings | undefined) => {
    onGestureStart()
    onUpdate(c => ({ motion: { ...c.motion, [target]: settings } }))
  }

  const patchCurrent = (changes: Partial<MotionSettings>) => {
    if (current) setMotion(phase, { ...current, ...changes })
  }

  /** Choisir une carte la pose et la joue ; recliquer sur la carte posée la retire. */
  const pick = (p: MotionPreset) => {
    if (current?.preset === p.id) {
      setMotion(phase, undefined)
      return
    }
    // On conserve la DURÉE choisie, pas le multiplicateur : une même vitesse
    // donne des durées différentes d'un mouvement à l'autre.
    const kept = preset
      ? Math.min(MAX_DURATION, Math.max(MIN_DURATION, presetDuration(preset, current?.speed ?? 1)))
      : presetDuration(p, 1)
    setMotion(phase, {
      preset: p.id,
      speed: Math.round((presetDuration(p, 1) / kept) * 1000) / 1000,
      delay: current?.delay ?? 0,
    })
    // Laisse le temps à la mise à jour d'atteindre le canvas.
    setTimeout(() => onPreview(phase), 40)
  }

  const slider = (
    label: string, value: number, onChange: (v: number) => void,
    min: number, max: number, step: number, format: (v: number) => string,
  ) => (
    <div className={styles.sliderBlock}>
      <div className={styles.sliderHead}>
        <span className={styles.fieldLabel}>{label}</span>
        <output className={styles.sliderValue}>{format(value)}</output>
      </div>
      <input
        type="range"
        className={`${styles.range} ${styles.rangeFull}`}
        min={min} max={max} step={step}
        value={value}
        aria-label={label}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
    </div>
  )

  return (
    <>
      {/* Une seule phase à l'écran : la liste n'est plus doublée. */}
      <div className={styles.segmented} role="tablist" aria-label="Phase du mouvement">
        {PHASES.map(ph => (
          <button
            key={ph.value}
            type="button"
            role="tab"
            aria-selected={phase === ph.value}
            title={ph.hint}
            className={`${styles.segment} ${phase === ph.value ? styles.segmentActive : ''}`}
            onClick={() => setPhase(ph.value)}
          >
            {ph.label}
            {motion[ph.value] && <span className={styles.phaseDot} aria-label="définie" />}
          </button>
        ))}
      </div>

      {hiddenUltra && (
        <p className={styles.hint}>
          « {preset?.label} » est un mouvement Ultra : il est conservé mais
          reste inactif tant que le mode Ultra Design est coupé.
        </p>
      )}

      {families.length > 1 && (
        <div className={styles.familyChips} role="group" aria-label="Famille de mouvement">
          {families.map(f => (
            <button
              key={f}
              type="button"
              className={`${styles.familyChip} ${family === f ? styles.familyChipActive : ''}`}
              onClick={() => setChosenFamily(c => ({ ...c, [phase]: f }))}
            >
              {FAMILY_LABELS[f] ?? f}
            </button>
          ))}
        </div>
      )}

      <div className={styles.motionGrid}>
        {visible.map(p => {
          const active = current?.preset === p.id
          return (
            <button
              key={p.id}
              type="button"
              className={[
                styles.motionCard,
                p.tier === 'ultra' ? styles.motionCardUltra : '',
                active ? styles.motionCardActive : '',
              ].join(' ')}
              style={previewStyle(p)}
              onClick={() => pick(p)}
              aria-pressed={active}
              title={active ? `${p.label} — cliquer pour retirer` : p.label}
            >
              <span className={`${styles.motionPreview} ${styles.motionPreviewWide}`}>
                <span className={styles.motionChip} />
              </span>
              <span className={styles.motionCardName}>{p.label}</span>
              {p.tier === 'ultra' && <span className={styles.motionUltraTag}><Icon name="ultra" size={9} /></span>}
            </button>
          )
        })}
      </div>

      {current && preset ? (() => {
        // Le fichier stocke un multiplicateur de vitesse (les projets existants
        // restent valides) ; l'interface parle en secondes, plus parlant.
        const base = presetDuration(preset, 1)
        const duration = base / (current.speed ?? 1)
        return (
          <div className={styles.motionSettings}>
            <div className={styles.motionSummary}>
              <span className={styles.motionSummaryName}>{preset.label}</span>
              <button type="button" className={styles.remove} onClick={() => setMotion(phase, undefined)}>
                retirer
              </button>
            </div>

            {slider(
              'Durée',
              Math.round(duration * 20) / 20,
              v => patchCurrent({ speed: Math.round((base / v) * 1000) / 1000 }),
              MIN_DURATION, MAX_DURATION, 0.05,
              v => `${v.toFixed(2).replace(/\.?0+$/, '')} s`,
            )}
            {slider('Délai avant le début', current.delay ?? 0, v => patchCurrent({ delay: v }), 0, 10, 0.1, v => `${v.toFixed(1)} s`)}
            {preset.split && slider(
              'Décalage entre lettres',
              current.stagger ?? (preset.split === 'chars' ? 0.035 : 0.09),
              v => patchCurrent({ stagger: v }),
              0, 0.5, 0.005,
              v => `${v.toFixed(3)} s`,
            )}

            <button type="button" className={styles.motionReplay} onClick={() => onPreview(phase)}>
              <Icon name="play" size={12} /> Aperçu
            </button>
          </div>
        )
      })() : (
        <p className={styles.hint}>
          {PHASES.find(p => p.value === phase)?.hint} : choisissez un mouvement, il se joue aussitôt.
          Recliquez dessus pour le retirer.
        </p>
      )}
    </>
  )
}
