import type { BlockComponentProps, ShapeBlockData } from '../../types'

export default function ShapeBlock({ block }: BlockComponentProps<ShapeBlockData>) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: block.backgroundColor ?? '#6c63ff',
      borderRadius: block.borderRadius ?? '4px',
      border: block.borderColor ? `${block.borderWidth ?? 2}px solid ${block.borderColor}` : 'none',
      opacity: block.opacity ?? 1,
    }} />
  )
}