import type { BlockData } from '../../types'

interface Props {
  block: BlockData
}

export default function ImageBlock({ block }: Props) {
  return block.src
    ? <img src={block.src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={block.alt} />
    : <div style={{ width: '100%', height: '100%', backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>Image</div>
}