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

/**
 * Joue l'animation d'entrée d'un bloc UNE FOIS quand `play` passe à true.
 * `play` doit être contrôlé par le parent (ex: PresentationMode quand la slide devient active).
 */
export function useBlockAnimation(
  elementRef: React.RefObject<HTMLElement | null>,
  animation: AnimationConfig | undefined,
  play: boolean
) {
  const hasPlayed = useRef(false)

  useEffect(() => {
    const el = elementRef.current
    if (!el || !animation || animation.type === 'none') return

    if (!play) {
      // Slide pas (encore) active : on remet l'état initial sans jouer
      gsap.set(el, ANIMATION_PRESETS[animation.type] ?? {})
      hasPlayed.current = false
      return
    }

    if (hasPlayed.current) return // déjà joué pour ce cycle "play"
    hasPlayed.current = true

    gsap.fromTo(
      el,
      ANIMATION_PRESETS[animation.type] ?? {},
      {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        duration: animation.duration ?? 0.6,
        delay: animation.delay ?? 0,
        ease: animation.ease ?? 'power2.out',
      }
    )
  }, [play, animation, elementRef])
}