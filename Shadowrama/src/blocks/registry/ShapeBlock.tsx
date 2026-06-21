import type { BlockData } from '../../types'

interface Props {
  block: BlockData
  onUpdate?: (id: number, changes: Partial<BlockData>) => void
  isEditing?: boolean
  onStartEdit?: () => void
  onStopEdit?: () => void
}

export default function ShapeBlock({ block }: Props) {
  const borderWidth = block.borderColor ? (block.borderWidth ?? 2) : 0
  const offset = -borderWidth / 2

  return (
    <div style={{
      position: 'absolute',
      top: offset,
      left: offset,
      right: offset,
      bottom: offset,
      backgroundColor: block.backgroundColor ?? '#6c63ff',
      borderRadius: block.borderRadius ?? '4px',
      border: borderWidth > 0 ? `${borderWidth}px solid ${block.borderColor}` : 'none',
      opacity: block.opacity ?? 1,
      boxSizing: 'border-box',
    }} />
  )
}