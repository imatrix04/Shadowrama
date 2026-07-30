import gsap from 'gsap'
import type { SlideKeyframe, SlideTransition } from '../types'
import { transitionDuration } from './slideTransitions'

/** État neutre : la diapositive occupe sa place, pleinement visible. */
const NEUTRAL: Required<SlideKeyframe> = {
  opacity: 1,
  xPercent: 0,
  yPercent: 0,
  scale: 1,
  rotateY: 0,
  rotateZ: 0,
  blur: 0,
}

function toVars(frame: SlideKeyframe): gsap.TweenVars {
  const merged = { ...NEUTRAL, ...frame }
  return {
    opacity: merged.opacity,
    xPercent: merged.xPercent,
    yPercent: merged.yPercent,
    scale: merged.scale,
    rotationY: merged.rotateY,
    rotation: merged.rotateZ,
    filter: merged.blur > 0 ? `blur(${merged.blur}px)` : 'blur(0px)',
  }
}

interface Options {
  outgoing: HTMLElement
  incoming: HTMLElement
  transition: SlideTransition
  speed?: number
}

/**
 * Joue une transition entre deux couches de diapositive.
 *
 * Les deux trajectoires démarrent ensemble : la sortante quitte l'état neutre
 * vers `from`, l'entrante rejoint l'état neutre depuis `to`. Jouées en parallèle,
 * elles se croisent — c'est ce croisement qui fait la transition.
 */
export function runSlideTransition({ outgoing, incoming, transition, speed = 1 }: Options) {
  const duration = transitionDuration(transition, speed)
  const ease = transition.ease ?? 'power2.inOut'

  const timeline = gsap.timeline()

  timeline.fromTo(
    outgoing,
    toVars({}),
    { ...toVars(transition.from), duration, ease },
    0,
  )
  timeline.fromTo(
    incoming,
    toVars(transition.to),
    // `clearProps` remet la couche entrante à un style vierge : elle redevient
    // la diapositive courante une fois la sortante démontée, et ne doit pas
    // conserver de transformation résiduelle.
    { ...toVars({}), duration, ease, clearProps: 'transform,filter,opacity' },
    0,
  )

  return timeline
}
