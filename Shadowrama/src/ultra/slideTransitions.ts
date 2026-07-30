import type { SlideTransition } from '../types'

/**
 * Transitions entre diapositives.
 *
 * Deux niveaux : `basic` regroupe ce que tout le monde attend d'un diaporama,
 * `ultra` les transitions marquantes, réservées au mode Ultra Design.
 *
 * Chaque transition décrit deux trajectoires jouées en même temps : la
 * diapositive sortante part de l'état neutre vers `from`, l'entrante part de
 * `to` pour rejoindre l'état neutre.
 */
export const SLIDE_TRANSITIONS: SlideTransition[] = [
  // ── Basiques ──────────────────────────────────────────────────────────────
  {
    id: 'none',
    label: 'Aucune',
    tier: 'basic',
    duration: 0,
    from: {},
    to: {},
  },
  {
    id: 'fade',
    label: 'Fondu',
    tier: 'basic',
    duration: 0.45,
    ease: 'power2.inOut',
    from: { opacity: 0 },
    to: { opacity: 0 },
  },
  {
    id: 'slide',
    label: 'Glissement',
    tier: 'basic',
    duration: 0.55,
    ease: 'power3.inOut',
    from: { xPercent: -100 },
    to: { xPercent: 100 },
  },
  {
    id: 'slide-up',
    label: 'Glissement vertical',
    tier: 'basic',
    duration: 0.55,
    ease: 'power3.inOut',
    from: { yPercent: -100 },
    to: { yPercent: 100 },
  },
  {
    id: 'zoom',
    label: 'Zoom',
    tier: 'basic',
    duration: 0.5,
    ease: 'power2.inOut',
    from: { opacity: 0, scale: 1.15 },
    to: { opacity: 0, scale: 0.9 },
  },

  // ── Ultra ─────────────────────────────────────────────────────────────────
  {
    id: 'blur-cross',
    label: 'Fondu au flou',
    tier: 'ultra',
    duration: 0.7,
    ease: 'power2.inOut',
    from: { opacity: 0, blur: 22, scale: 1.06 },
    to: { opacity: 0, blur: 22, scale: 0.96 },
  },
  {
    id: 'flip-3d',
    label: 'Bascule 3D',
    tier: 'ultra',
    duration: 0.8,
    ease: 'power3.inOut',
    from: { opacity: 0, rotateY: -75, scale: 0.85 },
    to: { opacity: 0, rotateY: 75, scale: 0.85 },
    perspective: true,
  },
  {
    id: 'zoom-through',
    label: 'Traversée',
    tier: 'ultra',
    duration: 0.75,
    ease: 'power3.inOut',
    from: { opacity: 0, scale: 2.4, blur: 14 },
    to: { opacity: 0, scale: 0.35, blur: 10 },
  },
  {
    id: 'swipe-tilt',
    label: 'Balayage incliné',
    tier: 'ultra',
    duration: 0.7,
    ease: 'power3.inOut',
    from: { opacity: 0, xPercent: -60, rotateZ: -8, scale: 0.9 },
    to: { opacity: 0, xPercent: 70, rotateZ: 8, scale: 0.9 },
  },
]

const BY_ID = new Map(SLIDE_TRANSITIONS.map(t => [t.id, t]))

export function getSlideTransition(id: string | undefined): SlideTransition | undefined {
  return id ? BY_ID.get(id) : undefined
}

/**
 * Transitions proposées. Hors mode Ultra Design, on masque le niveau `ultra` —
 * et une diapositive déjà réglée sur une transition Ultra retombe sur le fondu.
 */
export function availableTransitions(ultra: boolean): SlideTransition[] {
  return ultra ? SLIDE_TRANSITIONS : SLIDE_TRANSITIONS.filter(t => t.tier === 'basic')
}

export function transitionDuration(transition: SlideTransition, speed = 1): number {
  return transition.duration / (speed || 1)
}
