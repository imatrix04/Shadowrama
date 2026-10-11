import type { CSSProperties } from 'react'
import type { MediaFrameData } from '../../types'
import { polygonToMaskDataUri } from '../../utils/shapePolygon'

/**
 * Arrondi et découpe en forme libre d'un média (image, vidéo, vue de carrousel).
 *
 * Le masque CSS découpe le média dans la forme du polygone. `mask-size` en
 * pourcentage l'étire à la surface réelle : pas de souci de distorsion vu
 * qu'un masque n'a pas de bordure à garder proportionnée (contrairement au
 * bloc forme, où le tracé est généré en pixels réels — voir ShapeBlock.tsx).
 * `borderRadius` est reconverti en interne dans l'échelle abstraite du masque —
 * voir polygonToMaskDataUri.
 *
 * `width`/`height` sont les dimensions réelles de la surface : le masque est
 * généré en pixels, pas dans un repère abstrait.
 */
export function getFrameStyle(data: MediaFrameData, width: number, height: number): CSSProperties {
  const maskUri = data.shapeMode === 'grid'
    ? polygonToMaskDataUri(data.customShape, data.borderRadius ?? 0, width, height)
    : undefined

  return {
    // La grille personnalisée prend le pas sur l'arrondi classique : les
    // deux réglages n'ont plus de sens en même temps.
    borderRadius: maskUri ? 0 : (data.borderRadius ?? 0),
    objectFit: data.objectFit ?? 'cover',
    ...(maskUri ? {
      WebkitMaskImage: `url("${maskUri}")`,
      maskImage: `url("${maskUri}")`,
      WebkitMaskSize: '100% 100%',
      maskSize: '100% 100%',
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
    } : null),
  }
}