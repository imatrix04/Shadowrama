import { useRef, useState } from 'react'
import type { BlockData } from '../../types'
import { BLOCKS_REGISTRY } from '../../blocks'
import ContextMenu from './ContextMenu'

interface Props {
  block: BlockData
  isSelected: boolean
  onSelect: (block: BlockData, isMultiSelect: boolean) => void
  onUpdate: (id: number, changes: Partial<BlockData>) => void
  onDelete: (id: number) => void
  onMove: (id: number, x: number, y: number) => void
  onDragEnd: () => void
  onReorder: (id: number, direction: 'front' | 'back' | 'forward' | 'backward') => void
}

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const HANDLES: { dir: ResizeHandle; style: React.CSSProperties }[] = [
  { dir: 'n',  style: { top: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize',  width: 8, height: 8 } },
  { dir: 's',  style: { bottom: -4, left: '50%', transform: 'translateX(-50%)', cursor: 's-resize', width: 8, height: 8 } },
  { dir: 'e',  style: { right: -4, top: '50%', transform: 'translateY(-50%)', cursor: 'e-resize',  width: 8, height: 8 } },
  { dir: 'w',  style: { left: -4, top: '50%', transform: 'translateY(-50%)', cursor: 'w-resize',   width: 8, height: 8 } },
  { dir: 'ne', style: { top: -4, right: -4, cursor: 'ne-resize', width: 8, height: 8 } },
  { dir: 'nw', style: { top: -4, left: -4, cursor: 'nw-resize', width: 8, height: 8 } },
  { dir: 'se', style: { bottom: -4, right: -4, cursor: 'se-resize', width: 8, height: 8 } },
  { dir: 'sw', style: { bottom: -4, left: -4, cursor: 'sw-resize', width: 8, height: 8 } },
]

export default function Block({ block, isSelected, onSelect, onUpdate, onDelete, onMove, onDragEnd, onReorder }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const isDragging = useRef(false)
  const isResizing = useRef(false)
  const resizeDir = useRef<ResizeHandle | null>(null)
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0, bx: 0, by: 0 })
  const offset = useRef({ x: 0, y: 0 })
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const BlockComponent = BLOCKS_REGISTRY[block.type]

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return
    e.stopPropagation()
    const isMultiSelect = e.shiftKey || e.ctrlKey || e.metaKey
    onSelect(block, isMultiSelect)
    isDragging.current = true
    offset.current = { x: e.clientX - block.x, y: e.clientY - block.y }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return
      onMove(block.id,
        e.clientX - offset.current.x,
        e.clientY - offset.current.y,
      )
    }

  const handleMouseUp = () => {
    isDragging.current = false
    onDragEnd()  // ← efface les lignes
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleResizeMouseDown = (e: React.MouseEvent, dir: ResizeHandle) => {
    e.preventDefault()
    e.stopPropagation()
    isResizing.current = true
    resizeDir.current = dir
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      w: block.width,
      h: block.height,
      bx: block.x,
      by: block.y,
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const dx = e.clientX - resizeStart.current.x
      const dy = e.clientY - resizeStart.current.y
      const dir = resizeDir.current!
      const changes: Partial<BlockData> = {}

      if (dir.includes('e')) changes.width  = Math.max(40, resizeStart.current.w + dx)
      if (dir.includes('s')) changes.height = Math.max(20, resizeStart.current.h + dy)
      if (dir.includes('w')) {
        changes.width = Math.max(40, resizeStart.current.w - dx)
        changes.x     = resizeStart.current.bx + resizeStart.current.w - changes.width
      }
      if (dir.includes('n')) {
        changes.height = Math.max(20, resizeStart.current.h - dy)
        changes.y      = resizeStart.current.by + resizeStart.current.h - changes.height
      }

      onUpdate(block.id, changes)
    }

    const handleMouseUp = () => {
      isResizing.current = false
      resizeDir.current = null
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      style={{
        position: 'absolute',
        left: block.x,
        top: block.y,
        width: block.width,
        height: block.height,
        outline: isSelected && !isEditing ? '2px solid #6c63ff' : '2px solid transparent',
        cursor: isEditing ? 'text' : 'grab',
        userSelect: isEditing ? 'text' : 'none',
        boxSizing: 'border-box',
        zIndex: block.zIndex,
      }}
    >
      {BlockComponent && (
        <BlockComponent
          block={block}
          onUpdate={onUpdate}
          isEditing={isEditing}
          onStartEdit={() => setIsEditing(true)}
          onStopEdit={() => setIsEditing(false)}
        />
      )}

      {isSelected && !isEditing && HANDLES.map(({ dir, style }) => (
        <div
          key={dir}
          onMouseDown={e => handleResizeMouseDown(e, dir)}
          style={{
            position: 'absolute',
            width: 8,
            height: 8,
            backgroundColor: '#6c63ff',
            border: '1.5px solid #fff',
            borderRadius: '2px',
            zIndex: 10,
            ...style,
          }}
        />
      ))}

      {contextMenu && (
        <ContextMenu
          block={block}
          x={contextMenu.x}
          y={contextMenu.y}
          onUpdate={onUpdate}
          onReorder={onReorder}
          onDelete={onDelete}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}