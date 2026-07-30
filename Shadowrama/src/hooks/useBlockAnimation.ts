// hooks/useBlockAnimation.ts
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { AnimationConfig } from '../types'

const ANIMATION_PRESETS: Record<string, gsap.TweenVars> = {
  fadeIn: { opacity: 0 },
  slideInLeft: { opacity: 0, x: -60 },
  slideInRight: { opacity: 0, x: 60 },
  slideInUp: { opacity: 0, y: 40 },
  zoomIn: { opacity: 0, scale: 0.8 },
  none: {},
}

/** État visuel à atteindre en fin d'animation, propre au bloc. */
interface RestState {
  opacity: number
  rotation: number
}

/**
 * Joue l'animation d'entrée d'un bloc UNE FOIS quand `play` passe à true.
 * `play` doit être contrôlé par le parent (ex: PresentationMode quand la slide devient active).
 *
 * L'état de repos est passé explicitement : GSAP écrit `opacity` et `transform`
 * sur l'élément, il écraserait donc l'opacité et la rotation réglées sur le bloc
 * si l'animation visait un « opacity: 1 » et une rotation nulle en dur.
 */
export function useBlockAnimation(
  elementRef: React.RefObject<HTMLElement | null>,
  animation: AnimationConfig | undefined,
  play: boolean,
  rest: RestState = { opacity: 1, rotation: 0 },
) {
  const hasPlayed = useRef(false)

  useEffect(() => {
    const el = elementRef.current
    if (!el || !animation || animation.type === 'none') return

    if (!play) {
      // Slide pas (encore) active : on remet l'état initial sans jouer.
      gsap.set(el, { ...ANIMATION_PRESETS[animation.type], rotation: rest.rotation })
      hasPlayed.current = false
      return
    }

    if (hasPlayed.current) return // déjà joué pour ce cycle "play"
    hasPlayed.current = true

    gsap.fromTo(
      el,
      { ...ANIMATION_PRESETS[animation.type], rotation: rest.rotation },
      {
        opacity: rest.opacity,
        rotation: rest.rotation,
        x: 0,
        y: 0,
        scale: 1,
        duration: animation.duration ?? 0.6,
        delay: animation.delay ?? 0,
        ease: animation.ease ?? 'power2.out',
      }
    )
  }, [play, animation, elementRef, rest.opacity, rest.rotation])
}
