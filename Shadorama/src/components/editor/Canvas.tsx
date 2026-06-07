import { useRef, useState } from 'react'
import type { BlockData } from '../../types'
import Block from './Block'

interface Props {
  blocks: BlockData[]
  selectedBlock: BlockData | null
  onSelectBlock: (block: BlockData | null) => void
  onUpdateBlock: (id: number, changes: Partial<BlockData>) => void
}

export default function Canvas({ blocks, selectedBlock, onSelectBlock, onUpdateBlock }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) onSelectBlock(null)
  }

  return (
    <div style={styles.wrapper}>
      {/* Contrôles zoom */}
      <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', zIndex: 10, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} style={btnStyle}>−</button>
        <span style={{ color: '#aaa', fontSize: '0.8rem', minWidth: '40px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} style={btnStyle}>+</button>
        <button onClick={() => setZoom(1)} style={btnStyle}>↺</button>
      </div>

      <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.1s' }}></div>
      <div
        ref={canvasRef}
        style={styles.canvas}
        onClick={handleCanvasClick}
      >
        {blocks.map(block => (
          <Block
            key={block.id}
            block={block}
            isSelected={selectedBlock?.id === block.id}
            onSelect={onSelectBlock}
            onUpdate={onUpdateBlock}
          />
        ))}
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '0.3rem 0.6rem',
  backgroundColor: '#2a2a2a',
  border: '1px solid #444',
  borderRadius: '4px',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '0.85rem',
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a' },
  canvas: { width: '960px', height: '540px', backgroundColor: '#2d2d2d', position: 'relative', borderRadius: '8px', boxShadow: '0 0 40px rgba(0,0,0,0.5)', overflow: 'hidden' },
}