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
  selectedBlockIds: number[]
  onSelectBlocks: (ids: number[]) => void
  onUpdateBlock: (id: number, changes: Partial<BlockData>) => void
  onDeleteBlocks: (ids: number[]) => void
  onBlockDragEnd: () => void
}

export default function Canvas({ blocks, selectedBlockIds, onSelectBlocks, onUpdateBlock, onDeleteBlocks, onBlockDragEnd }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ zoom: 1, offset: { x: 0, y: 0 } })
  const { zoom, offset } = view
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const [snapLines, setSnapLines] = useState<SnapLine[]>([])
  
  const [selectionRect, setSelectionRect] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null)
  const isSelectingArea = useRef(false)
  const selectionStart = useRef({ x: 0, y: 0 })
  const hasDraggedSelection = useRef(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockIds.length > 0) {
        if (
          document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA' || 
          document.activeElement?.getAttribute('contenteditable') === 'true'
        ) {
          return
        }
        onDeleteBlocks(selectedBlockIds)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedBlockIds, onDeleteBlocks])

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
    } else if (e.button === 0 && (e.target === canvasRef.current || e.target === wrapperRef.current)) {
      e.preventDefault()
      isSelectingArea.current = true
      hasDraggedSelection.current = false
      const rect = canvasRef.current!.getBoundingClientRect()
      const x = (e.clientX - rect.left) / zoom
      const y = (e.clientY - rect.top) / zoom
      selectionStart.current = { x, y }
      setSelectionRect({ x1: x, y1: y, x2: x, y2: y })

      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        onSelectBlocks([])
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning.current) {
      setView(prev => ({
        ...prev,
        offset: {
          x: e.clientX - panStart.current.x,
          y: e.clientY - panStart.current.y,
        }
      }))
    } else if (isSelectingArea.current && canvasRef.current) {
      hasDraggedSelection.current = true
      const rect = canvasRef.current.getBoundingClientRect()
      const x = (e.clientX - rect.left) / zoom
      const y = (e.clientY - rect.top) / zoom
      setSelectionRect(prev => prev ? { ...prev, x2: x, y2: y } : null)

      const x1 = Math.min(selectionStart.current.x, x)
      const y1 = Math.min(selectionStart.current.y, y)
      const x2 = Math.max(selectionStart.current.x, x)
      const y2 = Math.max(selectionStart.current.y, y)

      const intersectingIds = blocks
        .filter(b => {
          const bx1 = b.x
          const by1 = b.y
          const bx2 = b.x + b.width
          const by2 = b.y + b.height
          return bx1 < x2 && bx2 > x1 && by1 < y2 && by2 > y1
        })
        .map(b => b.id)

      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        const combined = Array.from(new Set([...selectedBlockIds, ...intersectingIds]))
        onSelectBlocks(combined)
      } else {
        onSelectBlocks(intersectingIds)
      }
    }
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.button === 1) {
      isPanning.current = false
    } else if (e.button === 0 && isSelectingArea.current) {
      isSelectingArea.current = false
      setSelectionRect(null)
    }
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (hasDraggedSelection.current) {
      hasDraggedSelection.current = false
      return
    }
    if (e.target === canvasRef.current && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      onSelectBlocks([])
    }
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

  const handleBlockSelect = (block: BlockData, isMultiSelect: boolean) => {
    if (isMultiSelect) {
      if (selectedBlockIds.includes(block.id)) {
        onSelectBlocks(selectedBlockIds.filter(id => id !== block.id))
      } else {
        onSelectBlocks([...selectedBlockIds, block.id])
      }
    } else {
      if (!selectedBlockIds.includes(block.id)) {
        onSelectBlocks([block.id])
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
    const isMultiDrag = selectedBlockIds.includes(id)
    const nonSelectedOthers = isMultiDrag 
      ? others.filter(b => !selectedBlockIds.includes(b.id))
      : others

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
      ...nonSelectedOthers.flatMap(b => [b.x, b.x + b.width / 2, b.x + b.width])
    ]
    const hTargets: number[] = [
      0, CANVAS_H / 2, CANVAS_H,
      ...nonSelectedOthers.flatMap(b => [b.y, b.y + b.height / 2, b.y + b.height])
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

    const dx = x - block.x
    const dy = y - block.y

    onUpdateBlock(id, { x, y })

    if (isMultiDrag) {
      selectedBlockIds.forEach(selId => {
        if (selId === id) return
        const selBlock = blocks.find(b => b.id === selId)
        if (selBlock) {
          onUpdateBlock(selId, { x: selBlock.x + dx, y: selBlock.y + dy })
        }
      })
    }
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
                isSelected={selectedBlockIds.includes(block.id)}
                onSelect={handleBlockSelect}
                onUpdate={onUpdateBlock}
                onMove={handleBlockMove}
                onDragEnd={handleBlockDragEnd}
                onDelete={(id) => onDeleteBlocks([id])}
                onReorder={handleReorder}
              />
            ))}

          {selectionRect && (
            <div style={{
              position: 'absolute',
              left: Math.min(selectionRect.x1, selectionRect.x2),
              top: Math.min(selectionRect.y1, selectionRect.y2),
              width: Math.abs(selectionRect.x1 - selectionRect.x2),
              height: Math.abs(selectionRect.y1 - selectionRect.y2),
              border: '1.5px dashed #6c63ff',
              backgroundColor: 'rgba(108, 99, 255, 0.12)',
              pointerEvents: 'none',
              zIndex: 10000,
            }} />
          )}
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