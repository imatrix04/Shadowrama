import type { CSSProperties } from 'react'
import type { Keyframe, MotionPreset } from '../types'

type ResolvedKeyframe = Required<Keyframe>

const REST: ResolvedKeyframe = { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, skewX: 0, skewY: 0, blur: 0 }

function resolve(base: ResolvedKeyframe, patch: Keyframe): ResolvedKeyframe {
  return { ...base, ...patch }
}

// Les déplacements et flous réels (parfois ±160px) sont bien trop grands pour
// une puce de 16×11px : on les réduit à une échelle qui reste lisible dans
// la mini-scène, sans toucher aux valeurs utilisées par la vraie animation.
const shrinkOffset = (v: number) => `${Math.max(-14, Math.min(14, v / 8))}px`
const shrinkBlur = (v: number) => `${Math.min(4, v / 6)}px`

/**
 * Style à poser sur le conteneur du preset : des variables CSS custom que la
 * puce (`.motionChip`) consomme dans sa `@keyframes`. Une seule animation
 * générique sert pour tous les presets — seules ces variables changent.
 */
export function previewStyle(preset: MotionPreset): CSSProperties {
  const from = resolve(REST, preset.from)
  // `from` d'une sortie est vide (le bloc part de son état de repos) : le
  // pli initial est donc REST, et les étapes mènent vers l'état caché.
  const to = preset.steps.reduce((state, step) => resolve(state, step.to), from)

  return {
    '--demo-o0': from.opacity,
    '--demo-x0': shrinkOffset(from.x),
    '--demo-y0': shrinkOffset(from.y),
    '--demo-s0': from.scale,
    '--demo-r0': `${from.rotate}deg`,
    '--demo-kx0': `${from.skewX}deg`,
    '--demo-ky0': `${from.skewY}deg`,
    '--demo-b0': shrinkBlur(from.blur),
    '--demo-o1': to.opacity,
    '--demo-x1': shrinkOffset(to.x),
    '--demo-y1': shrinkOffset(to.y),
    '--demo-s1': to.scale,
    '--demo-r1': `${to.rotate}deg`,
    '--demo-kx1': `${to.skewX}deg`,
    '--demo-ky1': `${to.skewY}deg`,
    '--demo-b1': shrinkBlur(to.blur),
  } as CSSProperties
}