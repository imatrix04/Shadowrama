import { useRef } from 'react'
import type { CSSProperties, PointerEvent, ReactNode } from 'react'
import type { BlockData } from '../types'
import { effectFilter, cornerRadius, glassStyle, resolveGlass } from './effectStyle'
import glassCss from './Glass.module.css'

/**
 * Couche intermédiaire portant les effets visuels.
 *
 * Elle est distincte de l'élément animé : GSAP écrit `filter` et `transform`
 * pour les mouvements (flou, échelle, rotation), et écraserait donc les effets
 * s'ils vivaient sur le même nœud.
 */
export function EffectLayer({ block, children }: { block: BlockData; children: ReactNode }) {
  const fx = block.effects
  const ref = useRef<HTMLDivElement>(null)
  if (!fx) return <>{children}</>

  const glass = fx.glass
  const radius = cornerRadius(fx) ?? (glass ? `${glass.radius}px` : undefined)
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
    // `backdrop-filter` va sur CE nœud (et non sur un enfant) : un enfant d'un
    // élément portant `filter` n'aurait plus accès à l'arrière-plan à flouter.
    ...(glass ? glassStyle(glass) : null),
  }

  if (fx.textStroke) {
    style.WebkitTextStrokeWidth = `${fx.textStroke.width}px`
    style.WebkitTextStrokeColor = fx.textStroke.color
  }

  const g = glass ? resolveGlass(glass) : null

  // Position du curseur écrite directement dans le style : suivre la souris ne
  // doit pas re-rendre le bloc à chaque mouvement.
  const track = g?.reactive
    ? (e: PointerEvent<HTMLDivElement>) => {
        const el = ref.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width
        const py = (e.clientY - r.top) / r.height
        el.style.setProperty('--gx', `${px * 100}%`)
        el.style.setProperty('--gy', `${py * 100}%`)
        if (g.tilt > 0) {
          el.style.setProperty('--ry', `${(px - 0.5) * 2 * g.tilt}deg`)
          el.style.setProperty('--rx', `${-(py - 0.5) * 2 * g.tilt}deg`)
        }
      }
    : undefined

  const release = g?.reactive && g.tilt > 0
    ? () => {
        ref.current?.style.setProperty('--rx', '0deg')
        ref.current?.style.setProperty('--ry', '0deg')
      }
    : undefined

  const classes = g
    ? [glassCss.glass, g.reactive && glassCss.reactive, g.reactive && g.tilt > 0 && glassCss.tilt]
        .filter(Boolean).join(' ')
    : undefined

  return (
    <div
      ref={ref}
      style={style}
      className={classes}
      onPointerMove={track}
      onPointerLeave={release}
    >
      {children}
      {g && g.grain > 0 && <span className={glassCss.grain} aria-hidden="true" />}
      {g?.shine && <span className={glassCss.shine} aria-hidden="true" />}
      {g?.reactive && g.sheen > 0 && <span className={glassCss.sheen} aria-hidden="true" />}
    </div>
  )
}
