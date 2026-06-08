import type { BlockData } from '../../types'

interface Props {
  block: BlockData
  onUpdate?: (id: number, changes: Partial<BlockData>) => void
  isEditing?: boolean
  onStartEdit?: () => void
  onStopEdit?: () => void
}

export default function ImageBlock({ block }: Props) {
  return block.src
    ? <img src={block.src} style={{ width: '100%', height: '100%', objectFit: block.objectFit ?? 'cover' }} alt={block.alt ?? ''} />
    : (
      <div style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666',
        fontSize: '0.85rem',
        borderRadius: '4px',
        border: '2px dashed #555',
      }}>
        🖼️ Image
      </div>
    )
}