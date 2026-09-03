// components/ui/SettingRow.tsx
import type { ReactNode } from 'react'
import Icon from './Icon'
import styles from './SettingRow.module.css'

interface Props {
  title: string
  description?: string
  /** Contrôle affiché à droite (Switch, sélecteur segmenté, etc.). Ignoré si
   *  `locked` est vrai — remplacé par le badge cadenas. */
  children?: ReactNode
  /**
   * Fonctionnalité pas encore livrée : le contrôle est remplacé par un badge
   * cadenas, rien n'est cliquable. Sert de gabarit pour préparer un réglage
   * dans l'UI avant que la fonctionnalité derrière ne soit prête — poser la
   * ligne, la garder verrouillée, puis basculer `locked` à `false` le jour où
   * elle sort.
   */
  locked?: boolean
  lockedLabel?: string
}

export default function SettingRow({
  title, description, children, locked = false, lockedLabel = 'Bientôt disponible',
}: Props) {
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <span className={styles.title}>{title}</span>
        {description && <span className={styles.description}>{description}</span>}
      </div>
      <div className={styles.control}>
        {locked ? (
          <span className={styles.lockedBadge}>
            <Icon name="lock" size={13} />
            {lockedLabel}
          </span>
        ) : children}
      </div>
    </div>
  )
}