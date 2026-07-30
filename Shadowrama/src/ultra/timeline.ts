import gsap from 'gsap'
import type { Keyframe, MotionPreset, MotionSettings } from '../types'
import { getPreset } from './presets'

/** État de repos du bloc, à ne jamais écraser (voir useBlockAnimation). */
export interface RestState {
  opacity: number
  rotation: number
}

/**
 * Traduit un keyframe en variables GSAP.
 *
 * `rotate` s'ajoute à la rotation propre du bloc, et `blur` passe par un filtre.
 * Le filtre est écrit sur l'élément de mouvement, jamais sur la couche d'effets :
 * sans cette séparation, une animation de flou effacerait les ombres et filtres
 * réglés sur le bloc (voir EffectLayer).
 */
function toTweenVars(frame: Keyframe, rest: RestState): gsap.TweenVars {
  const vars: gsap.TweenVars = {}
  if (frame.opacity !== undefined) vars.opacity = frame.opacity * rest.opacity
  if (frame.x !== undefined) vars.x = frame.x
  if (frame.y !== undefined) vars.y = frame.y
  if (frame.scale !== undefined) vars.scale = frame.scale
  if (frame.skewX !== undefined) vars.skewX = frame.skewX
  if (frame.skewY !== undefined) vars.skewY = frame.skewY
  vars.rotation = rest.rotation + (frame.rotate ?? 0)
  if (frame.blur !== undefined) {
    vars.filter = frame.blur > 0 ? `blur(${frame.blur}px)` : 'blur(0px)'
  }
  return vars
}

const CHAR_CLASS = 'ultra-split-char'

/**
 * Découpe le texte d'un élément en fragments animables.
 *
 * Renvoie les fragments, et une fonction pour restaurer le texte d'origine :
 * l'élément peut être `contentEditable`, il ne doit pas rester farci de `<span>`
 * après l'aperçu.
 */
export function splitText(el: HTMLElement, mode: 'chars' | 'words'): {
  fragments: HTMLElement[]
  restore: () => void
} {
  const original = el.innerHTML
  const text = el.innerText

  const pieces = mode === 'chars'
    ? Array.from(text)
    : text.split(/(\s+)/)

  el.textContent = ''
  const fragments: HTMLElement[] = []

  for (const piece of pieces) {
    // Les espaces restent du texte brut : les envelopper casserait le retour
    // à la ligne automatique.
    if (/^\s+$/.test(piece)) {
      el.appendChild(document.createTextNode(piece))
      continue
    }
    const span = document.createElement('span')
    span.className = CHAR_CLASS
    span.textContent = piece
    span.style.display = 'inline-block'
    span.style.willChange = 'transform, opacity'
    el.appendChild(span)
    fragments.push(span)
  }

  return {
    fragments,
    restore: () => { el.innerHTML = original },
  }
}

export interface BuildOptions {
  settings: MotionSettings
  rest: RestState
  /** Élément portant le texte, si le preset découpe. */
  textElement?: HTMLElement | null
}

export interface BuiltTimeline {
  timeline: gsap.core.Timeline
  /** À appeler à la fin ou à l'annulation : restaure le texte découpé. */
  cleanup: () => void
}

/**
 * Construit une timeline GSAP à partir d'un preset.
 *
 * Les étapes s'enchaînent dans l'ordre ; un preset découpé anime ses fragments
 * en cascade plutôt que l'élément entier.
 */
export function buildTimeline(target: HTMLElement, options: BuildOptions): BuiltTimeline | null {
  const preset: MotionPreset | undefined = getPreset(options.settings.preset)
  if (!preset) return null

  const speed = options.settings.speed && options.settings.speed > 0 ? options.settings.speed : 1
  const timeline = gsap.timeline({ delay: options.settings.delay ?? 0 })

  let cleanup = () => {}
  let animated: HTMLElement | HTMLElement[] = target
  let stagger = 0

  if (preset.split && options.textElement) {
    const split = splitText(options.textElement, preset.split)
    if (split.fragments.length > 0) {
      animated = split.fragments
      cleanup = split.restore
      // Un texte long ne doit pas s'étirer indéfiniment : on resserre la cascade
      // au-delà d'une trentaine de fragments.
      const requested = options.settings.stagger ?? (preset.split === 'chars' ? 0.035 : 0.09)
      stagger = split.fragments.length > 30 ? requested * 0.5 : requested
    }
  }

  timeline.set(animated, toTweenVars(preset.from, options.rest))

  for (const step of preset.steps) {
    timeline.to(animated, {
      ...toTweenVars(step.to, options.rest),
      duration: step.duration / speed,
      ease: step.ease ?? 'power2.out',
      ...(stagger ? { stagger } : {}),
    })
  }

  return { timeline, cleanup }
}

/** Remet un élément animé dans son état de repos, sans transition. */
export function gsapReset(el: HTMLElement, opacity: number) {
  gsap.set(el, { clearProps: 'transform,filter', opacity })
}
