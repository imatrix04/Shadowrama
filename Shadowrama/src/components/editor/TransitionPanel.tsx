import type { SlideTransition, SlideTransitionSettings } from '../../types'
import { availableTransitions, getSlideTransition, transitionDuration } from '../../ultra/slideTransitions'
import { transitionPreviewStyle } from '../../ultra/presetPreview'
import styles from './PanelControls.module.css'
import Icon from '../ui/Icon'

interface Props {
  slideIndex: number
  current: SlideTransitionSettings | undefined
  /** Le niveau « ultra » n'est proposé qu'en mode Ultra Design. */
  ultra: boolean
  onChange: (settings: SlideTransitionSettings | undefined) => void
}

const MIN_DURATION = 0.2
const MAX_DURATION = 3

export default function TransitionPanel({ slideIndex, current, ultra, onChange }: Props) {
  const transitions = availableTransitions(ultra).filter(t => t.id !== 'none')
  const selected = getSlideTransition(current?.preset)
  const speed = current?.speed ?? 1

  // Une transition Ultra posée puis le mode coupé : elle reste enregistrée mais
  // n'apparaît plus dans la grille. On le dit plutôt que de laisser un réglage
  // invisible et sans effet.
  const hiddenUltra = !ultra && selected?.tier === 'ultra'

  /**
   * Recliquer sur la transition posée la retire. En changeant de transition, on
   * conserve la DURÉE choisie (pas le multiplicateur : une même vitesse donne
   * des durées différentes selon la transition) en la ramenant dans la plage
   * du curseur.
   */
  const pick = (t: SlideTransition) => {
    if (current?.preset === t.id) {
      onChange(undefined)
      return
    }
    const kept = selected ? Math.min(MAX_DURATION, Math.max(MIN_DURATION, transitionDuration(selected, speed))) : t.duration
    onChange({ preset: t.id, speed: Math.round((t.duration / kept) * 1000) / 1000 })
  }

  // Le fichier stocke un multiplicateur de vitesse (les projets existants
  // restent valides) ; l'interface parle en secondes.
  const base = selected?.duration ?? 0
  const duration = selected ? transitionDuration(selected, speed) : 0

  return (
    <>
      <p className={styles.subtle}>
        <strong>Diapositive {slideIndex + 1}</strong> — s'applique en <strong>entrant</strong> sur cette diapositive.
      </p>

      {hiddenUltra && (
        <p className={styles.hint}>
          « {selected?.label} » est une transition Ultra : elle est conservée mais
          reste inactive tant que le mode Ultra Design est coupé.
        </p>
      )}

      <div className={styles.motionGrid}>
        {transitions.map(t => {
          const active = current?.preset === t.id
          return (
            <button
              key={t.id}
              type="button"
              className={[
                styles.motionCard,
                t.tier === 'ultra' ? styles.motionCardUltra : '',
                active ? styles.motionCardActive : '',
              ].join(' ')}
              style={transitionPreviewStyle(t)}
              onClick={() => pick(t)}
              aria-pressed={active}
              title={active ? `${t.label} — cliquer pour retirer` : t.label}
            >
              <span className={`${styles.motionPreview} ${styles.motionPreviewWide}`}>
                <span className={styles.motionChip} />
              </span>
              <span className={styles.motionCardName}>{t.label}</span>
              {t.tier === 'ultra' && <span className={styles.motionUltraTag}><Icon name="ultra" size={9} /></span>}
            </button>
          )
        })}
      </div>

      {selected ? (
        <div className={styles.motionSettings}>
          <div className={styles.motionSummary}>
            <span className={styles.motionSummaryName}>{selected.label}</span>
            <button type="button" className={styles.remove} onClick={() => onChange(undefined)}>
              retirer
            </button>
          </div>

          <div className={styles.sliderBlock}>
            <div className={styles.sliderHead}>
              <span className={styles.fieldLabel}>Durée</span>
              <output className={styles.sliderValue}>{(Math.round(duration * 20) / 20).toFixed(2).replace(/\.?0+$/, '')} s</output>
            </div>
            <input
              type="range"
              className={`${styles.range} ${styles.rangeFull}`}
              min={MIN_DURATION} max={MAX_DURATION} step={0.05}
              value={Math.round(duration * 20) / 20}
              aria-label="Durée de la transition"
              onChange={e => onChange({ preset: selected.id, speed: Math.round((base / parseFloat(e.target.value)) * 1000) / 1000 })}
            />
          </div>
        </div>
      ) : (
        <p className={styles.hint}>
          Choisissez une transition. Recliquez dessus pour la retirer : la diapositive apparaît alors sans effet.
        </p>
      )}
    </>
  )
}
