import type { BlockComponentProps, ImageBlockData } from '../../types'
import { resolveMedia } from '../../utils/mediaStore'
import Icon from '../../components/ui/Icon'

export default function ImageBlock({ block }: BlockComponentProps<ImageBlockData>) {
  const resolvedSrc = block.src?.startsWith('media/') ? resolveMedia(block.src) : block.src

  if (resolvedSrc) {
    return (
      <img
        src={resolvedSrc}
        alt={block.alt ?? ''}
        draggable={false}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          borderRadius: block.borderRadius ?? 0,
          objectFit: block.objectFit ?? 'cover',
        }}
      />
    )
  }

  // Emplacement vide. L'emoji 🖼️ qui figurait ici était le dernier de
  // l'application, et le seul visible sur la diapositive elle-même.
  return (
    <div style={{
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.35rem',
      backgroundColor: 'var(--editor-bg-canvas)',
      color: 'var(--editor-text-muted)',
      border: '2px dashed var(--editor-border-light)',
      borderRadius: `${block.borderRadius ?? 4}px`,
      fontSize: '0.8rem',
      userSelect: 'none',
    }}>
      <Icon name="image" size={22} />
      Aucune image
    </div>
  )
}
