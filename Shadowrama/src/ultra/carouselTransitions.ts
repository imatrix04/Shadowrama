import type { CarouselTransition } from '../types'

/** Sens de navigation : 1 = vue suivante, -1 = vue précédente. */
export type CarouselDirection = 1 | -1

export interface CarouselLayerState {
  transform: string
  opacity: number
}

export interface CarouselTransitionDef {
  id: CarouselTransition
  label: string
  /** Ajoute une perspective au cadre, nécessaire aux rotations 3D. */
  perspective?: boolean
  /** État de départ de la vue qui arrive : elle rejoint ensuite l'état neutre. */
  enter(dir: CarouselDirection): CarouselLayerState
  /** État visé par la vue qui s'en va, qui part de l'état neutre. */
  exit(dir: CarouselDirection): CarouselLayerState
}

/**
 * Chaque animation est décrite par deux états seulement — celui d'où arrive la
 * nouvelle vue, celui vers lequel part l'ancienne. Le retour à l'état neutre
 * est assuré par la transition CSS, sans timeline à piloter.
 *
 * `dir` inverse mécaniquement l'animation quand on revient en arrière : sans
 * lui, la flèche « précédent » ferait défiler dans le même sens que « suivant ».
 */
export const CAROUSEL_TRANSITIONS: CarouselTransitionDef[] = [
  {
    id: 'slide-left',
    label: 'Défilement horizontal',
    enter: dir => ({ transform: `translateX(${100 * dir}%)`, opacity: 1 }),
    exit: dir => ({ transform: `translateX(${-100 * dir}%)`, opacity: 1 }),
  },
  {
    id: 'slide-right',
    label: 'Défilement horizontal inversé',
    enter: dir => ({ transform: `translateX(${-100 * dir}%)`, opacity: 1 }),
    exit: dir => ({ transform: `translateX(${100 * dir}%)`, opacity: 1 }),
  },
  {
    id: 'slide-up',
    label: 'Défilement vertical',
    enter: dir => ({ transform: `translateY(${100 * dir}%)`, opacity: 1 }),
    exit: dir => ({ transform: `translateY(${-100 * dir}%)`, opacity: 1 }),
  },
  {
    id: 'slide-down',
    label: 'Défilement vertical inversé',
    enter: dir => ({ transform: `translateY(${-100 * dir}%)`, opacity: 1 }),
    exit: dir => ({ transform: `translateY(${100 * dir}%)`, opacity: 1 }),
  },
  {
    id: 'fade',
    label: 'Fondu',
    enter: () => ({ transform: 'none', opacity: 0 }),
    exit: () => ({ transform: 'none', opacity: 0 }),
  },
  {
    id: 'zoom',
    label: 'Zoom',
    enter: () => ({ transform: 'scale(0.86)', opacity: 0 }),
    exit: () => ({ transform: 'scale(1.18)', opacity: 0 }),
  },
  {
    id: 'flip',
    label: 'Retournement',
    perspective: true,
    enter: dir => ({ transform: `rotateY(${90 * dir}deg)`, opacity: 0 }),
    exit: dir => ({ transform: `rotateY(${-90 * dir}deg)`, opacity: 0 }),
  },
  {
    id: 'stack',
    label: 'Empilement',
    enter: dir => ({ transform: `translateY(${34 * dir}%) scale(0.92)`, opacity: 0 }),
    exit: dir => ({ transform: `translateY(${-12 * dir}%) scale(1.06)`, opacity: 0 }),
  },
]

export const CAROUSEL_EASINGS: { label: string; value: string }[] = [
  { label: 'Douce', value: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  { label: 'Entrée / sortie', value: 'ease-in-out' },
  { label: 'Linéaire', value: 'linear' },
  { label: 'Rebond', value: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
]

const BY_ID = new Map(CAROUSEL_TRANSITIONS.map(t => [t.id, t]))

/** Retombe sur le défilement horizontal : un projet peut nommer une animation
 *  retirée depuis, le carrousel doit rester affichable. */
export function getCarouselTransition(id: string | undefined): CarouselTransitionDef {
  return BY_ID.get((id ?? '') as CarouselTransition) ?? CAROUSEL_TRANSITIONS[0]
}