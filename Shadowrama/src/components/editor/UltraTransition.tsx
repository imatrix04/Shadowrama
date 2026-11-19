import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../ui/Icon'
import styles from './UltraTransition.module.css'

/** Sélecteur du bouton qui déclenche la transition (voir TopBar). */
const ORIGIN_SELECTOR = '[data-ultra-toggle]'
const DURATION_MS = 1900

interface Burst {
  id: number
  on: boolean
}

// Étincelles : angles et distances fixes (déterministes) pour un rendu pur,
// répartis assez irrégulièrement pour ne pas ressembler à un cadran.
const SPARKS = Array.from({ length: 18 }, (_, i) => ({
  angle: i * 20 + ((i * 37) % 11),
  distance: 90 + ((i * 53) % 130),
  size: 3 + ((i * 7) % 4),
  delay: (i % 6) * 22,
}))

/**
 * Transition du mode Ultra Design : au clic, une onde d'énergie part du bouton
 * et balaie la fenêtre (activation), ou se résorbe vers lui (désactivation),
 * avec un bandeau de confirmation. Purement décoratif : aucune interaction.
 */
export default function UltraTransition({ ultra }: { ultra: boolean }) {
  const [seen, setSeen] = useState(ultra)
  const [burst, setBurst] = useState<Burst | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // Changement détecté PENDANT le rendu : la première valeur (ouverture de
  // l'éditeur) n'en déclenche pas, et aucun effet n'a à resynchroniser l'état.
  if (ultra !== seen) {
    setSeen(ultra)
    setBurst(b => ({ id: (b?.id ?? 0) + 1, on: ultra }))
  }

  const id = burst?.id
  useLayoutEffect(() => {
    if (id === undefined) return
    const root = rootRef.current
    const origin = document.querySelector(ORIGIN_SELECTOR)?.getBoundingClientRect()
    if (root) {
      root.style.setProperty('--ox', `${origin ? origin.left + origin.width / 2 : window.innerWidth - 120}px`)
      root.style.setProperty('--oy', `${origin ? origin.top + origin.height / 2 : 30}px`)
    }
    const timer = window.setTimeout(() => setBurst(null), DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [id])

  if (!burst) return null

  return createPortal(
    <div
      key={burst.id}
      ref={rootRef}
      className={`${styles.root} ${burst.on ? styles.on : styles.off}`}
      aria-hidden="true"
    >
      <div className={styles.wash} />
      <div className={styles.ring} />
      <div className={`${styles.ring} ${styles.ringLate}`} />
      {burst.on && SPARKS.map((s, i) => (
        <span
          key={i}
          className={styles.spark}
          style={{
            '--angle': `${s.angle}deg`,
            '--distance': `${s.distance}px`,
            '--size': `${s.size}px`,
            animationDelay: `${s.delay}ms`,
          } as CSSProperties}
        />
      ))}
      <div className={styles.label}>
        <Icon name="ultra" size={14} />
        {burst.on ? 'Mode Ultra Design activé' : 'Mode Ultra Design désactivé'}
      </div>
    </div>,
    document.body,
  )
}
