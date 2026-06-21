import { useRef, useState, useEffect } from 'react'
import type { BlockData } from '../../types'
import Block from './Block'
import styles from './Canvas.module.css'

const CANVAS_W = 960
const CANVAS_H = 540
const SNAP_THRESHOLD = 5

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
  onBlockDragEnd: () => void
}

export default function Canvas({ blocks, selectedBlock, onSelectBlock, onUpdateBlock, onDeleteBlock, onBlockDragEnd }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ zoom: 1, offset: { x: 0, y: 0 } })
  const { zoom, offset } = view
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const [snapLines, setSnapLines] = useState<SnapLine[]>([])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedBlock) {
        onDeleteBlock(selectedBlock.id)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedBlock])

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      if (!e.shiftKey) {
        const rect = el.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        const delta = -e.deltaY * 0.001

        setView(prev => {
          const newZoom = Math.min(3, Math.max(0.25, prev.zoom + delta * prev.zoom))
          if (newZoom === prev.zoom) return prev
          return {
            zoom: newZoom,
            offset: {
              x: mouseX - (mouseX - prev.offset.x) * (newZoom / prev.zoom),
              y: mouseY - (mouseY - prev.offset.y) * (newZoom / prev.zoom),
            }
          }
        })
        return
      }

      setView(prev => ({
        ...prev,
        offset: {
          x: prev.offset.x - e.deltaX,
          y: prev.offset.y - e.deltaY,
        }
      }))
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      isPanning.current = true
      panStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning.current) return
    setView(prev => ({
      ...prev,
      offset: {
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      }
    }))
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.button === 1) isPanning.current = false
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) onSelectBlock(null)
  }

  const handleReorder = (id: number, direction: 'front' | 'back' | 'forward' | 'backward') => {
    const sorted = [...blocks].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    const idx = sorted.findIndex(b => b.id === id)
    if (idx === -1) return

    const getZ = (b: BlockData, i: number) => b.zIndex ?? i

    if (direction === 'front') {
      const maxZ = Math.max(...blocks.map((b, i) => getZ(b, i)), 0)
      onUpdateBlock(id, { zIndex: maxZ + 1 })
    } else if (direction === 'back') {
      const minZ = Math.min(...blocks.map((b, i) => getZ(b, i)), 0)
      onUpdateBlock(id, { zIndex: minZ - 1 })
    } else if (direction === 'forward') {
      if (idx < sorted.length - 1) {
        const nextBlock = sorted[idx + 1]
        const val1 = getZ(sorted[idx], idx)
        const val2 = getZ(nextBlock, idx + 1)
        onUpdateBlock(sorted[idx].id, { zIndex: val2 === val1 ? val1 + 1 : val2 })
        onUpdateBlock(nextBlock.id, { zIndex: val1 })
      }
    } else if (direction === 'backward') {
      if (idx > 0) {
        const prevBlock = sorted[idx - 1]
        const val1 = getZ(sorted[idx], idx)
        const val2 = getZ(prevBlock, idx - 1)
        onUpdateBlock(sorted[idx].id, { zIndex: val2 === val1 ? val1 - 1 : val2 })
        onUpdateBlock(prevBlock.id, { zIndex: val1 })
      }
    }
  }

  const zoomAtCenter = (newZoom: number) => {
    const el = wrapperRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2

    setView(prev => ({
      zoom: newZoom,
      offset: {
        x: cx - (cx - prev.offset.x) * (newZoom / prev.zoom),
        y: cy - (cy - prev.offset.y) * (newZoom / prev.zoom),
      }
    }))
  }

  const handleBlockMove = (id: number, rawX: number, rawY: number) => {
    const block = blocks.find(b => b.id === id)
    if (!block) return

    const others = blocks.filter(b => b.id !== id)
    let x = rawX
    let y = rawY
    const lines: SnapLine[] = []

    const bCenterX = x + block.width / 2
    const bCenterY = y + block.height / 2
    const bRight = x + block.width
    const bBottom = y + block.height

    const vSources = [
      { val: x, label: 'left' },
      { val: bCenterX, label: 'centerX' },
      { val: bRight, label: 'right' },
    ]

    const hSources = [
      { val: y, label: 'top' },
      { val: bCenterY, label: 'centerY' },
      { val: bBottom, label: 'bottom' },
    ]

    const vTargets: number[] = [
      0, CANVAS_W / 2, CANVAS_W,
      ...others.flatMap(b => [b.x, b.x + b.width / 2, b.x + b.width])
    ]
    const hTargets: number[] = [
      0, CANVAS_H / 2, CANVAS_H,
      ...others.flatMap(b => [b.y, b.y + b.height / 2, b.y + b.height])
    ]

    for (const src of vSources) {
      for (const target of vTargets) {
        if (Math.abs(src.val - target) < SNAP_THRESHOLD) {
          x += target - src.val
          lines.push({ type: 'v', pos: target })
          break
        }
      }
    }

    for (const src of hSources) {
      for (const target of hTargets) {
        if (Math.abs(src.val - target) < SNAP_THRESHOLD) {
          y += target - src.val
          lines.push({ type: 'h', pos: target })
          break
        }
      }
    }

    setSnapLines(lines)
    onUpdateBlock(id, { x, y })
  }

  const handleBlockDragEnd = () => {
    setSnapLines([])
    onBlockDragEnd()
  }

  return (
    <div
      ref={wrapperRef}
      className={styles.wrapper}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div style={{
        transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
        transformOrigin: '0 0',
        transition: isPanning.current ? 'none' : 'transform 0.05s',
      }}>
        <div ref={canvasRef} className={styles.canvas} onClick={handleCanvasClick}>

          {snapLines.map((line, i) => (
            <div
              key={i}
              className={line.type === 'v' ? styles.snapLineV : styles.snapLineH}
              style={line.type === 'v' ? { left: line.pos } : { top: line.pos }}
            />
          ))}

          {[...blocks]
            .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
            .map(block => (
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

      <div className={styles.zoomControls}>
        <button onClick={() => zoomAtCenter(Math.max(0.25, zoom - 0.1))} className={styles.zoomBtn}>−</button>
        <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => zoomAtCenter(Math.min(3, zoom + 0.1))} className={styles.zoomBtn}>+</button>
        <button onClick={() => setView({ zoom: 1, offset: { x: 0, y: 0 } })} className={styles.zoomBtn}>↺</button>
      </div>
    </div>
  )
}