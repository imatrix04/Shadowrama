import { useRef, useState, useEffect } from 'react'
import type { BlockData } from '../../types'
import Block from './Block'

const CANVAS_W = 960
const CANVAS_H = 540
const SNAP_THRESHOLD = 8

interface SnapLine {
  type: 'h' | 'v'
  pos: number
}

interface Props {
  blocks: BlockData[]
  selectedBlock: BlockData | null
  onSelectBlock: (block: BlockData | null) => void
  onUpdateBlock: (id: number, changes: Partial<BlockData>) => void
  onDeleteBlock: (id: number) => void
}

export default function Canvas({ blocks, selectedBlock, onSelectBlock, onUpdateBlock, onDeleteBlock }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [snapLines, setSnapLines] = useState<SnapLine[]>([])

  useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlock) {
      onDeleteBlock(selectedBlock.id)
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedBlock])

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

  // Appelé par Block pendant le drag
  const handleBlockMove = (id: number, rawX: number, rawY: number) => {
    const block = blocks.find(b => b.id === id)
    if (!block) return

    const others = blocks.filter(b => b.id !== id)
    let x = rawX
    let y = rawY
    const lines: SnapLine[] = []

    // Points du bloc en mouvement
    const bCenterX = x + block.width / 2
    const bCenterY = y + block.height / 2
    const bRight   = x + block.width
    const bBottom  = y + block.height

    // ── Axes verticaux à checker (x, centerX, right)
    const vSources = [
      { val: x,        label: 'left' },
      { val: bCenterX, label: 'centerX' },
      { val: bRight,   label: 'right' },
    ]

    // ── Axes horizontaux à checker (y, centerY, bottom)
    const hSources = [
      { val: y,        label: 'top' },
      { val: bCenterY, label: 'centerY' },
      { val: bBottom,  label: 'bottom' },
    ]

    // Cibles : canvas + autres blocs
    const vTargets: number[] = [
      0, CANVAS_W / 2, CANVAS_W,
      ...others.flatMap(b => [b.x, b.x + b.width / 2, b.x + b.width])
    ]
    const hTargets: number[] = [
      0, CANVAS_H / 2, CANVAS_H,
      ...others.flatMap(b => [b.y, b.y + b.height / 2, b.y + b.height])
    ]

    // Snap vertical
    for (const src of vSources) {
      for (const target of vTargets) {
        if (Math.abs(src.val - target) < SNAP_THRESHOLD) {
          const offset = target - src.val
          x += offset
          lines.push({ type: 'v', pos: target })
          break
        }
      }
    }

    // Snap horizontal
    for (const src of hSources) {
      for (const target of hTargets) {
        if (Math.abs(src.val - target) < SNAP_THRESHOLD) {
          const offset = target - src.val
          y += offset
          lines.push({ type: 'h', pos: target })
          break
        }
      }
    }

    setSnapLines(lines)
    onUpdateBlock(id, { x, y })
  }

  const handleBlockDragEnd = () => setSnapLines([])

  return (
    <div ref={wrapperRef} style={styles.wrapper}>
      <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.15s' }}>
        <div ref={canvasRef} style={styles.canvas} onClick={handleCanvasClick}>

          {/* Lignes de snap */}
          {snapLines.map((line, i) =>
            line.type === 'v' ? (
              <div key={i} style={{
                position: 'absolute',
                top: 0, bottom: 0,
                left: line.pos,
                width: 1,
                backgroundColor: '#6c63ff',
                opacity: 0.8,
                pointerEvents: 'none',
                zIndex: 1000,
              }} />
            ) : (
              <div key={i} style={{
                position: 'absolute',
                left: 0, right: 0,
                top: line.pos,
                height: 1,
                backgroundColor: '#6c63ff',
                opacity: 0.8,
                pointerEvents: 'none',
                zIndex: 1000,
              }} />
            )
          )}

          {blocks.map(block => (
            <Block
              key={block.id}
              block={block}
              isSelected={selectedBlock?.id === block.id}
              onSelect={onSelectBlock}
              onUpdate={onUpdateBlock}
              onMove={handleBlockMove}
              onDragEnd={handleBlockDragEnd}
              onDelete={onDeleteBlock} 
              onReorder={handleReorder}
            />
          ))}
        </div>
      </div>

      <div style={{
        position: 'fixed', bottom: '1.5rem', left: '50%',
        transform: 'translateX(-50%)', zIndex: 200,
        display: 'flex', gap: '0.5rem', alignItems: 'center',
        backgroundColor: '#1a1a1a', border: '1px solid #333',
        borderRadius: '8px', padding: '0.4rem 0.75rem',
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
  padding: '0.3rem 0.6rem', backgroundColor: '#2a2a2a',
  border: '1px solid #444', borderRadius: '4px',
  color: '#fff', cursor: 'pointer', fontSize: '0.85rem',
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a' },
  canvas: { width: '960px', height: '540px', backgroundColor: '#2d2d2d', position: 'relative', borderRadius: '8px', boxShadow: '0 0 40px rgba(0,0,0,0.5)', overflow: 'hidden' },
}