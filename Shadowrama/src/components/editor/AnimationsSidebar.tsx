import { useState } from 'react'
import type { AnimationType } from '../../types'
import styles from './AnimationsSidebar.module.css'

interface Props {
  onSelectAnimation: (type: AnimationType) => void
}

const ANIMATIONS: { label: string; value: AnimationType }[] = [
  { label: 'Aucune', value: 'none' },
  { label: 'Fondu', value: 'fadeIn' },
  { label: 'Glisse depuis la gauche', value: 'slideInLeft' },
  { label: 'Glisse depuis la droite', value: 'slideInRight' },
  { label: 'Glisse depuis le bas', value: 'slideInUp' },
  { label: 'Zoom', value: 'zoomIn' },
]

export default function AnimationsSidebar({ onSelectAnimation }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className={styles.wrapper}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`${styles.toggleBtn} ${open ? styles.toggleBtnOpen : ''}`}
        title={open ? 'Fermer Animations' : 'Ouvrir Animations'}
        >
        <span>{open ? '◀' : '▶'}</span>
        <span className={styles.toggleLabel}>Animations</span>
      </button>

      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.panelInner}>
          <p className={styles.title}>Animations</p>
          {ANIMATIONS.map(anim => (
            <button
              key={anim.value}
              className={styles.blockBtn}
              onClick={() => onSelectAnimation(anim.value)}
            >
              {anim.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}