import type { BlockComponentProps, ImageBlockData } from '../../types'
import { resolveMedia } from '../../utils/mediaStore'

export default function ImageBlock({ block }: BlockComponentProps<ImageBlockData>) {
  const resolvedSrc = block.src?.startsWith('media/') ? resolveMedia(block.src) : block.src

  return resolvedSrc
    ? <img src={resolvedSrc} style={{ width: '100%', height: '100%', borderRadius: block.borderRadius ?? '0px', objectFit: block.objectFit ?? 'cover' }} alt={block.alt ?? ''} />
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