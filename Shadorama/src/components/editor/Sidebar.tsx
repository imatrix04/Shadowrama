import type { BlockConfig } from '../../types'
import { BLOCKS_CONFIG } from '../../blocks'

interface Props {
  onAddBlock: (block: Partial<BlockConfig['defaultProps']> & { type: string }) => void
}

export default function Sidebar({ onAddBlock }: Props) {
  const handleAdd = (config: BlockConfig) => {
    onAddBlock({ type: config.type, ...config.defaultProps })
  }

  return (
    <div style={styles.sidebar}>
      <h3 style={styles.title}>Blocs</h3>
      {BLOCKS_CONFIG.map(config => (
        <button key={config.type} style={styles.block} onClick={() => handleAdd(config)}>
          {config.label}
        </button>
      ))}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: { width: '200px', backgroundColor: '#111', padding: '1rem', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' },
  title: { margin: '0 0 1rem 0', color: '#aaa', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' },
  block: { padding: '0.6rem', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '6px', color: '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem' },
}