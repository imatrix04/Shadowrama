import { useState } from 'react'
import type { AnimationType, BlockConfig } from '../../types'
import { BLOCKS_CONFIG } from '../../blocks'
import styles from './LeftSidebars.module.css'

interface Props {
  onAddBlock: (block: Partial<BlockConfig['defaultProps']> & { type: string }) => void
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

type PanelKey = 'blocs' | 'animations' | null

export default function LeftSidebars({ onAddBlock, onSelectAnimation }: Props) {
  const [openPanel, setOpenPanel] = useState<PanelKey>(null)

  const handleAdd = (config: BlockConfig) => {
    onAddBlock({ type: config.type, ...config.defaultProps })
  }

  const toggle = (key: PanelKey) => {
    setOpenPanel(prev => (prev === key ? null : key))
  }

  return (
    <div className={styles.wrapper}>
      <button
        className={`${styles.toggleBtn} ${styles.toggleBtnBlocs} ${openPanel === 'blocs' ? styles.toggleBtnOpen : ''}`}
        onClick={() => toggle('blocs')}
        title={openPanel === 'blocs' ? 'Fermer Blocs' : 'Ouvrir Blocs'}
      >
        <span>{openPanel === 'blocs' ? '◀' : '▶'}</span>
        <span className={styles.toggleLabel}>Blocs</span>
      </button>

      <button
        className={`${styles.toggleBtn} ${styles.toggleBtnAnimations} ${openPanel === 'animations' ? styles.toggleBtnOpen : ''}`}
        onClick={() => toggle('animations')}
        title={openPanel === 'animations' ? 'Fermer Animations' : 'Ouvrir Animations'}
      >
        <span>{openPanel === 'animations' ? '◀' : '▶'}</span>
        <span className={styles.toggleLabel}>Animations</span>
      </button>

      <div className={`${styles.panel} ${openPanel ? styles.panelOpen : ''}`}>
        {openPanel === 'blocs' && (
          <div className={styles.panelInner}>
            <p className={styles.title}>Blocs</p>
            {BLOCKS_CONFIG.map(config => (
              <button key={config.type} className={styles.blockBtn} onClick={() => handleAdd(config)}>
                {config.label}
              </button>
            ))}
          </div>
        )}
        {openPanel === 'animations' && (
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
        )}
      </div>
    </div>
  )
}