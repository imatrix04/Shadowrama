import type { ImageRenderData } from '../../types'
import { resolveMedia } from '../../utils/mediaStore'
import { polygonToMaskDataUri } from '../../utils/shapePolygon'
import Icon from '../../components/ui/Icon'

interface Props {
  data: ImageRenderData
  /** Dimensions réelles de la surface : le masque de forme est généré en
   *  pixels, pas dans un repère abstrait. */
  width: number
  height: number
  className?: string
  style?: React.CSSProperties
  /** Texte de l'emplacement vide. */
  emptyLabel?: string
}

/**
 * Rendu d'une image : cadrage, arrondi et découpe en forme libre.
 *
 * Extrait de ImageBlock pour être partagé avec le carrousel — chaque vue d'un
 * carrousel se règle ainsi exactement comme un bloc image, sans duplication de
 * la logique de masque.
 */
export default function ImageSurface({ data, width, height, className, style, emptyLabel = 'Aucune image' }: Props) {
  const resolvedSrc = data.src?.startsWith('media/') ? resolveMedia(data.src) : data.src

  // Le masque CSS découpe l'image dans la forme du polygone. `mask-size` en
  // pourcentage l'étire à la surface réelle : pas de souci de distorsion vu
  // qu'un masque n'a pas de bordure à garder proportionnée (contrairement au
  // bloc forme, où le tracé est généré en pixels réels — voir ShapeBlock.tsx).
  // `borderRadius` est reconverti en interne dans l'échelle abstraite du
  // masque — voir polygonToMaskDataUri.
  const maskUri = data.shapeMode === 'grid'
    ? polygonToMaskDataUri(data.customShape, data.borderRadius ?? 0, width, height)
    : undefined
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
        alt={data.alt ?? ''}
        draggable={false}
        className={className}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          // La grille personnalisée prend le pas sur l'arrondi classique : les
          // deux réglages n'ont plus de sens en même temps.
          borderRadius: maskUri ? 0 : (data.borderRadius ?? 0),
          objectFit: data.objectFit ?? 'cover',
          ...maskStyle,
          ...style,
        }}
      />
    )
  }

  return (
    <div className={className} style={{
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
      borderRadius: `${data.borderRadius ?? 4}px`,
      fontSize: '0.8rem',
      userSelect: 'none',
      ...style,
    }}>
      <Icon name="image" size={22} />
      {emptyLabel}
    </div>
  )
}