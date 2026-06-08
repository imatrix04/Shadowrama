import { useRef, useState } from 'react'
import type { BlockData } from '../../types'
import { BLOCKS_REGISTRY } from '../../blocks'
import ContextMenu from './ContextMenu'

interface Props {
  block: BlockData
  isSelected: boolean
  onSelect: (block: BlockData) => void
  onUpdate: (id: number, changes: Partial<BlockData>) => void
  onReorder: (id: number, direction: 'front' | 'back' | 'forward' | 'backward') => void // ← ajout
}

export default function Block({ block, isSelected, onSelect, onUpdate, onReorder }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const isDragging = useRef(false)
  const offset = useRef({ x: 0, y: 0 })
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null)

  const BlockComponent = BLOCKS_REGISTRY[block.type]

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return // bloque drag pendant édition
    e.stopPropagation()
    onSelect(block)
    isDragging.current = true
    offset.current = { x: e.clientX - block.x, y: e.clientY - block.y }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      onUpdate(block.id, { x: e.clientX - offset.current.x, y: e.clientY - offset.current.y })
    }

    const handleMouseUp = () => {
      isDragging.current = false
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
        zIndex: block.zIndex ?? 0, // ← ajout
        outline: isSelected && !isEditing ? '2px solid #6c63ff' : '2px solid transparent',
        cursor: isEditing ? 'text' : 'grab',
        userSelect: isEditing ? 'text' : 'none',
        boxSizing: 'border-box',
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
      {contextMenu && (
        <ContextMenu
          block={block}
          x={contextMenu.x}
          y={contextMenu.y}
          onUpdate={onUpdate}
          onReorder={onReorder}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}