import { useState } from 'react'
import type { BlockConfig } from '../../types'
import { BLOCKS_CONFIG } from '../../blocks'

interface Props {
  onAddBlock: (block: Partial<BlockConfig['defaultProps']> & { type: string }) => void
}

export default function Sidebar({ onAddBlock }: Props) {
  const [open, setOpen] = useState(false)

  const handleAdd = (config: BlockConfig) => {
    onAddBlock({ type: config.type, ...config.defaultProps })
  }

  return (
    <div style={{ display: 'flex', flexShrink: 0, position: 'relative' }}>
      {/* Panel avec animation */}
      <div style={{
        width: open ? '200px' : '0px',
        overflow: 'hidden',
        transition: 'width 0.2s ease',
        height: '100%',
        backgroundColor: '#111',
        borderRight: open ? '1px solid #333' : 'none',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}>
        <div style={{ padding: '0.75rem 0.5rem', minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
          <p style={styles.title}>Blocs</p>
          {BLOCKS_CONFIG.map(config => (
            <button key={config.type} style={styles.block} onClick={() => handleAdd(config)}>
              {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bouton toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'absolute',
          top: '1rem',
          right: open ? '-16px' : '-28px',
          zIndex: 51,
          width: '28px',
          height: '28px',
          backgroundColor: '#2a2a2a',
          border: '1px solid #444',
          borderRadius: '0 6px 6px 0',
          color: '#aaa',
          cursor: 'pointer',
          fontSize: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'right 0.2s',
        }}
      >
        {open ? '◀' : '▶'}
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    margin: '0 0 0.5rem 0',
    color: '#aaa',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  block: {
    padding: '0.6rem',
    backgroundColor: '#2a2a2a',
    border: '1px solid #444',
    borderRadius: '6px',
    color: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '0.85rem',
    width: '100%',
  },
}