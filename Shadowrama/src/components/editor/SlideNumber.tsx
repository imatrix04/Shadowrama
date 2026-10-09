import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import type { MotionPreset, SlideBackground, SlideNumbering } from '../../types'
import { buildTimeline, gsapReset } from '../../ultra/timeline'
import { getPreset } from '../../ultra/presets'
import { readableTextColor } from '../../utils/textContrast'
import {
  COUNT_PRESET, CUSTOM_PRESET, DEFAULT_CUSTOM_MOTION,
  formatNumber, lastNumberValue, slideNumberText, slideNumberValue,
} from '../../utils/numbering'
import styles from './SlideNumber.module.css'

interface Props {
  /** Index de la diapositive (0 = première). */
  index: number
  total: number
  numbering: SlideNumbering
  background: SlideBackground | undefined
  ultra: boolean
  /** Rejoue l'animation à chaque changement de valeur (absent ou 0 = jamais) :
   *  la présentation passe une constante (jeu au montage), l'éditeur un nonce
   *  pour l'aperçu à la demande. */
  playKey?: number
  /** Secondes à attendre avant de démarrer : transition de diapo en cours. */
  entranceDelay?: number
}

/** Mouvement composé à la main : part de la pose réglée, rejoint le repos. */
function customPreset(numbering: SlideNumbering): MotionPreset {
  const custom = numbering.animation?.custom ?? DEFAULT_CUSTOM_MOTION
  return {
    id: CUSTOM_PRESET,
    label: 'Manuel',
    tier: 'ultra',
    phase: 'in',
    family: 'fondu',
    from: custom.from,
    steps: [{
      to: { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, skewX: 0, skewY: 0, blur: 0 },
      duration: custom.duration,
      ease: custom.ease,
    }],
  }
}

export default function SlideNumber({
  index, total, numbering, background, ultra, playKey, entranceDelay = 0,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const text = slideNumberText(index, total, numbering)

  // L'effet d'animation ne dépend QUE de `playKey` : changer la taille ou le
  // format pendant l'édition ne doit pas relancer l'animation. Il lit donc les
  // valeurs courantes ici (cet effet-ci est déclaré avant, il s'exécute avant).
  const latest = useRef({ numbering, ultra, text, index, total, entranceDelay })
  useEffect(() => {
    latest.current = { numbering, ultra, text, index, total, entranceDelay }
  })

  useEffect(() => {
    if (!playKey) return
    const el = ref.current
    const { numbering, ultra, text, index, total, entranceDelay } = latest.current
    const animation = numbering.animation
    if (!el || !text || !ultra || !animation) return

    const speed = animation.speed && animation.speed > 0 ? animation.speed : 1
    const delay = entranceDelay + (animation.delay ?? 0)

    // Les numéros sont écrits par `dangerouslySetInnerHTML` : React ne touche
    // pas à leur contenu tant que le texte ne change pas, on peut donc le
    // découper ou le réécrire à la main sans le désynchroniser.
    if (animation.preset === COUNT_PRESET) {
      const target = slideNumberValue(index, numbering)
      const last = lastNumberValue(total, numbering)
      const state = { v: 0 }
      gsap.set(el, { opacity: 0 })
      const tween = gsap.to(state, {
        v: target,
        duration: 0.9 / speed,
        delay,
        ease: 'power2.out',
        onStart: () => { gsap.set(el, { opacity: 1 }) },
        onUpdate: () => { el.textContent = formatNumber(state.v, last, numbering.format) },
        onComplete: () => { el.textContent = text },
      })
      return () => {
        tween.kill()
        el.innerHTML = text
        gsapReset(el, 1)
      }
    }

    const preset = animation.preset === CUSTOM_PRESET ? customPreset(numbering) : getPreset(animation.preset)
    if (!preset) return
    const built = buildTimeline(el, {
      settings: { preset: preset.id, speed, delay },
      rest: { opacity: 1, rotation: 0 },
      textElement: preset.split ? el : null,
      preset,
    })
    if (!built) return
    return () => {
      built.timeline.kill()
      built.cleanup()
      gsapReset(el, 1)
    }
  }, [playKey])

  if (!text) return null

  return (
    <div
      className={`${styles.number} ${styles[numbering.position]}`}
      style={{
        fontSize: numbering.size,
        fontWeight: numbering.bold ? 700 : 500,
        opacity: numbering.opacity,
        color: numbering.color ?? readableTextColor(background, ultra),
      }}
      aria-hidden="true"
    >
      <span ref={ref} className={styles.text} dangerouslySetInnerHTML={{ __html: text }} />
    </div>
  )
}