import type { CSSProperties, ReactNode } from 'react'
import type { BlockData } from '../types'
import { effectFilter, cornerRadius } from './effectStyle'

/**
 * Couche intermédiaire portant les effets visuels.
 *
 * Elle est distincte de l'élément animé : GSAP écrit `filter` et `transform`
 * pour les mouvements (flou, échelle, rotation), et écraserait donc les effets
 * s'ils vivaient sur le même nœud.
 */
export function EffectLayer({ block, children }: { block: BlockData; children: ReactNode }) {
  const fx = block.effects
  if (!fx) return <>{children}</>

  const radius = cornerRadius(fx)
  const style: CSSProperties = {
    width: '100%',
    height: '100%',
    position: 'relative',
    filter: effectFilter(fx),
    mixBlendMode: fx.blendMode && fx.blendMode !== 'normal' ? fx.blendMode : undefined,
    borderRadius: radius,
    // Le rognage n'est appliqué que si un arrondi par coin est défini : sinon
    // il couperait les ombres portées des formes SVG.
    overflow: radius ? 'hidden' : undefined,
  }

  if (fx.textStroke) {
    style.WebkitTextStrokeWidth = `${fx.textStroke.width}px`
    style.WebkitTextStrokeColor = fx.textStroke.color
  }

  return <div style={style}>{children}</div>
}
