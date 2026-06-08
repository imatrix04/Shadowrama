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
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) onSelectBlock(null)
  }

  const handleReorder = (id: number, direction: 'front' | 'back' | 'forward' | 'backward') => {
  onUpdateBlock(id, {
    zIndex: direction === 'front' ? 999
          : direction === 'back' ? 0
          : direction === 'forward' ? ((blocks.find(b => b.id === id)?.zIndex ?? 0) + 1)
          : Math.max(0, (blocks.find(b => b.id === id)?.zIndex ?? 0) - 1)
  })
  }

  return (
    <div ref={wrapperRef} style={styles.wrapper}>

      <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.15s' }}>
        <div ref={canvasRef} style={styles.canvas} onClick={handleCanvasClick}>
          {blocks.map(block => (
            <Block
            key={block.id}
            block={block}
            isSelected={selectedBlock?.id === block.id}
            onSelect={onSelectBlock}
            onUpdate={onUpdateBlock}
            onReorder={handleReorder} // ← ajout
          />
          ))}
        </div>
      </div>

      {/* position: fixed → toujours au même endroit peu importe le zoom */}
      <div style={{
        position: 'fixed',
        bottom: '1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '0.4rem 0.75rem',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}>
        <button onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} style={btnStyle}>−</button>
        <span style={{ color: '#aaa', fontSize: '0.8rem', minWidth: '42px', textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} style={btnStyle}>+</button>
        <button onClick={() => setZoom(1)} style={btnStyle}>↺</button>
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