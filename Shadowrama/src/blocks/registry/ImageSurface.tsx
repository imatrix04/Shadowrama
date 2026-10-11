import type { ImageRenderData } from '../../types'
import { resolveMedia } from '../../utils/mediaStore'
import { getFrameStyle } from './frameStyle'
import MediaPlaceholder from './MediaPlaceholder'

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
 * la logique de masque (voir frameStyle, aussi utilisé par le bloc vidéo).
 */
export default function ImageSurface({ data, width, height, className, style, emptyLabel = 'Aucune image' }: Props) {
  const resolvedSrc = data.src?.startsWith('media/') ? resolveMedia(data.src) : data.src

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
          ...getFrameStyle(data, width, height),
          ...style,
        }}
      />
    )
  }

  return (
    <MediaPlaceholder
      icon="image"
      label={emptyLabel}
      borderRadius={data.borderRadius}
      className={className}
      style={style}
    />
  )
}