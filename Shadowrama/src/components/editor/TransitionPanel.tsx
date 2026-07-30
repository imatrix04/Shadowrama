import type { SlideTransitionSettings } from '../../types'
import { availableTransitions, getSlideTransition, transitionDuration } from '../../ultra/slideTransitions'
import styles from './PanelControls.module.css'

interface Props {
  slideIndex: number
  current: SlideTransitionSettings | undefined
  /** Le niveau « ultra » n'est proposé qu'en mode Ultra Design. */
  ultra: boolean
  onChange: (settings: SlideTransitionSettings | undefined) => void
}

const TIER_LABELS = {
  basic: 'Classiques',
  ultra: 'Ultra',
} as const

export default function TransitionPanel({ slideIndex, current, ultra, onChange }: Props) {
  const transitions = availableTransitions(ultra)
  const selected = getSlideTransition(current?.preset)
  const speed = current?.speed ?? 1

  // Une transition Ultra posée puis le mode coupé : elle reste enregistrée mais
  // n'apparaît plus dans la liste. On le dit plutôt que de laisser un réglage
  // invisible et sans effet.
  const hiddenUltra = !ultra && selected?.tier === 'ultra'

  const byTier = new Map<string, typeof transitions>()
  for (const t of transitions) {
    if (t.id === 'none') continue
    const list = byTier.get(t.tier) ?? []
    list.push(t)
    byTier.set(t.tier, list)
  }

  const select = (id: string) => {
    onChange(id === 'none' ? undefined : { preset: id, speed })
  }

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

      <p className={styles.subtle}>
        S'applique en <strong>entrant</strong> sur cette diapositive.
      </p>

      {hiddenUltra && (
        <p className={styles.hint}>
          « {selected?.label} » est une transition Ultra : elle est conservée mais
          reste inactive tant que le mode Ultra Design est coupé.
        </p>
      )}

      <div className={styles.group}>
        <div className={styles.presetList}>
          <button
            className={`${styles.preset} ${!current ? styles.presetActive : ''}`}
            onClick={() => select('none')}
          >
            <span className={styles.presetName}>Aucune</span>
          </button>
        </div>

        {[...byTier.entries()].map(([tier, list]) => (
          <div key={tier}>
            <p className={styles.family}>{TIER_LABELS[tier as 'basic' | 'ultra'] ?? tier}</p>
            <div className={styles.presetList}>
              {list.map(t => (
                <button
                  key={t.id}
                  className={`${styles.preset} ${current?.preset === t.id ? styles.presetActive : ''}`}
                  onClick={() => select(t.id)}
                  title={`Durée : ${transitionDuration(t, speed).toFixed(2)} s`}
                >
                  <span className={styles.presetName}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className={styles.group}>
          <p className={styles.groupLabel}>Réglages</p>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Vitesse</span>
            <input
              type="range"
              className={styles.range}
              min={0.25} max={3} step={0.25}
              value={speed}
              onChange={e => onChange({ preset: selected.id, speed: parseFloat(e.target.value) })}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              Durée : {transitionDuration(selected, speed).toFixed(2)} s
            </span>
          </div>
        </div>
      )}
    </>
  )
}
