import type { BlockComponentProps, ImageBlockData } from '../../types'
import { resolveMedia } from '../../utils/mediaStore'
import { gridToMaskDataUri } from '../../utils/shapeGrid'
import Icon from '../../components/ui/Icon'

export default function ImageBlock({ block }: BlockComponentProps<ImageBlockData>) {
  const resolvedSrc = block.src?.startsWith('media/') ? resolveMedia(block.src) : block.src

  // Le masque CSS découpe l'image dans la forme de la grille. `mask-size` en
  // pourcentage l'étire au bloc réel : pas de souci de distorsion vu qu'un
  // masque n'a pas de bordure à garder proportionnée (contrairement au bloc
  // forme, où le tracé est généré en pixels réels — voir ShapeBlock.tsx).
  const maskUri = block.shapeMode === 'grid' ? gridToMaskDataUri(block.customShape) : undefined
  const maskStyle = maskUri ? {
    WebkitMaskImage: `url("${maskUri}")`,
    maskImage: `url("${maskUri}")`,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
  } : undefined

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
          // La grille personnalisée prend le pas sur l'arrondi classique : les
          // deux réglages n'ont plus de sens en même temps.
          borderRadius: maskUri ? 0 : (block.borderRadius ?? 0),
          objectFit: block.objectFit ?? 'cover',
          ...maskStyle,
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