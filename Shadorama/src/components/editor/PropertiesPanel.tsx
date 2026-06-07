import type { BlockData, BlockProperty } from '../../types'

interface Props {
  block: BlockData | null
  onUpdateBlock: (id: number, changes: Partial<BlockData>) => void
}

export default function PropertiesPanel({ block, onUpdateBlock }: Props) {
  if (!block) return (
    <div style={styles.panel}>
      <p style={styles.empty}>Sélectionne un bloc</p>
    </div>
  )

  const renderField = (prop: BlockProperty) => {
    switch (prop.type) {
      case 'textarea':
        return <textarea key={prop.key} style={styles.textarea} value={block[prop.key] ?? ''} onChange={e => onUpdateBlock(block.id, { [prop.key]: e.target.value })} />
      case 'number':
        return <input key={prop.key} style={styles.input} type="number" value={block[prop.key] ?? 0} onChange={e => onUpdateBlock(block.id, { [prop.key]: Number(e.target.value) })} />
      case 'color':
        return <input key={prop.key} style={styles.inputColor} type="color" value={block[prop.key] ?? '#ffffff'} onChange={e => onUpdateBlock(block.id, { [prop.key]: e.target.value })} />
      case 'text':
        return <input key={prop.key} style={styles.input} type="text" value={block[prop.key] ?? ''} onChange={e => onUpdateBlock(block.id, { [prop.key]: e.target.value })} />
      default:
        return null
    }
  }

  return (
    <div style={styles.panel}>
      <h3 style={styles.title}>Propriétés</h3>
      <p style={styles.type}>{block.type}</p>
      {block.properties?.map(prop => (
        <div key={prop.key} style={styles.field}>
          <label style={styles.label}>{prop.label}</label>
          {renderField(prop)}
        </div>
      ))}
      <div style={styles.position}>
        <span>X: {Math.round(block.x)}px</span>
        <span>Y: {Math.round(block.y)}px</span>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: { width: '220px', backgroundColor: '#111', padding: '1rem', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' },
  title: { margin: '0 0 0.25rem 0', color: '#aaa', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' },
  type: { margin: '0 0 1rem 0', color: '#555', fontSize: '0.75rem' },
  empty: { color: '#555', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  label: { fontSize: '0.75rem', color: '#888' },
  input: { padding: '0.4rem', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '0.85rem' },
  textarea: { padding: '0.4rem', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '0.85rem', resize: 'vertical', minHeight: '60px' },
  inputColor: { width: '100%', height: '36px', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  position: { marginTop: '1rem', display: 'flex', gap: '1rem', color: '#555', fontSize: '0.75rem' },
}