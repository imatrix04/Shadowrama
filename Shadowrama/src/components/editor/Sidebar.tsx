import { useState } from 'react'
import type { BlockConfig } from '../../types'
import { BLOCKS_CONFIG } from '../../blocks'
import styles from './Sidebar.module.css'

interface Props {
  onAddBlock: (block: Partial<BlockConfig['defaultProps']> & { type: string }) => void
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path
        d={direction === 'left' ? 'M7 1L2.5 5L7 9' : 'M3 1L7.5 5L3 9'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function Sidebar({ onAddBlock }: Props) {
  const [open, setOpen] = useState(false)

  const handleAdd = (config: BlockConfig) => {
    onAddBlock({ type: config.type, ...config.defaultProps })
  }

  return (
    <div className={styles.wrapper}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`${styles.toggleBtn} ${open ? styles.toggleBtnOpen : ''}`}
        title={open ? 'Fermer Blocs' : 'Ouvrir Blocs'}
      >
        <span>{open ? '◀' : '▶'}</span>
        <span className={styles.toggleLabel}>Blocs</span>
      </button>

      <div className={`${styles.panel} ${open ? styles.panelOpen : ''}`}>
        <div className={styles.panelInner}>
          <p className={styles.title}>Blocs</p>
          {BLOCKS_CONFIG.map(config => (
            <button key={config.type} className={styles.blockBtn} onClick={() => handleAdd(config)}>
              {config.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}