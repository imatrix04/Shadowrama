import { useState } from 'react'
import type { BlockConfig } from '../../types'
import { BLOCKS_CONFIG } from '../../blocks'

interface Props {
  onAddBlock: (block: Partial<BlockConfig['defaultProps']> & { type: string }) => void
}

export default function Sidebar({ onAddBlock }: Props) {
  const [open, setOpen] = useState(true)

  const handleAdd = (config: BlockConfig) => {
    onAddBlock({ type: config.type, ...config.defaultProps })
  }

  return (
    <>
    <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 50, flexShrink: 0, height: '100vh' }}>

      {/* Bouton toggle toujours visible */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'absolute',
          top: '1rem',
          right: open ? '-16px' : '-36px',
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

      {/* Panel */}
      <div style={{
        width: open ? '300px' : '0px',
        overflow: 'hidden',
        transition: 'width 0.2s ease',
        height: '100vh',
        backgroundColor: '#111',
        borderRight: open ? '1px solid #333' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        boxSizing: 'border-box',
      }}>
        <div style={{ padding: '1rem', minWidth: '200px' }}>
          <h3 style={styles.title}>Blocs</h3>
          {BLOCKS_CONFIG.map(config => (
            <button key={config.type} style={styles.block} onClick={() => handleAdd(config)}>
              {config.label}
            </button>
          ))}
        </div>
      </div>

    </div>

    {/* Spacer pour que le canvas ne se cache pas sous la sidebar */}
    <div style={{ width: open ? '300px' : '0px', flexShrink: 0, transition: 'width 0.2s ease' }} />
  </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  title: { margin: '0 0 1rem 0', color: '#aaa', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' },
  block: { padding: '0.6rem', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '6px', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem', width: '100%', marginBottom: '0.5rem' },
}