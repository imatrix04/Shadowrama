import { useState } from 'react'
import type { BlockConfig } from '../../types'
import { BLOCKS_CONFIG } from '../../blocks'
import styles from './Sidebar.module.css'

interface Props {
  onAddBlock: (block: Partial<BlockConfig['defaultProps']> & { type: string }) => void
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
      >
        {open ? '◀' : '▶'}
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