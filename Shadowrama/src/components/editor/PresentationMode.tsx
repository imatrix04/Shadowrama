import { useState, useEffect, useRef, useCallback } from 'react'
import { useBlockAnimation } from '../../hooks/useBlockAnimation'
import type { Slide, BlockData } from '../../types'
import { BLOCKS_REGISTRY } from '../../blocks'
import { EffectLayer } from '../../ultra/effects'
import { viewBlock } from '../../ultra/effectStyle'
import { buildTimeline } from '../../ultra/timeline'
import { getPreset, presetDuration } from '../../ultra/presets'
import { getSlideTransition, transitionDuration } from '../../ultra/slideTransitions'
import { runSlideTransition } from '../../ultra/slideTransitionRunner'
import { getSlideBackgroundStyle } from '../../ultra/SlideBackground'
import floatStyles from './BlockFloat.module.css'
import styles from './PresentationMode.module.css'

interface Props {
  slides: Slide[]
  onClose: () => void
  /** Hors mode Ultra, la présentation ignore effets et séquences. */
  ultra: boolean
}

/** Temps nécessaire pour que toutes les sorties d'une diapositive s'achèvent. */
function exitDuration(slide: Slide): number {
  let longest = 0
  for (const block of slide.blocks) {
    const settings = block.motion?.out
    const preset = getPreset(settings?.preset)
    if (!settings || !preset) continue
    longest = Math.max(longest, (settings.delay ?? 0) + presetDuration(preset, settings.speed ?? 1))
  }
  return longest
}

const CONTROLS_REVEAL_ZONE_PX = 80
const CONTROLS_HIDE_DELAY_MS = 1500

// Petit composant wrapper qui applique le hook par bloc
function AnimatedBlockWrapper({ block, isActive, exiting }: {
  block: BlockData
  isActive: boolean
  /** La diapositive s'en va : on joue la séquence de sortie. */
  exiting: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const opacity = block.opacity ?? 1
  const rotation = block.rotation ?? 0

  // Une séquence Ultra prend le pas sur l'ancienne animation simple. Le hook
  // historique n'est appelé que si aucune séquence n'est définie, sinon les deux
  // écriraient sur le même élément.
  const motionIn = block.motion?.in
  const motionOut = block.motion?.out
  // L'état de repos est communiqué au hook : sans lui, GSAP terminerait sur une
  // opacité de 1 et une rotation nulle, effaçant les réglages du bloc.
  useBlockAnimation(ref, motionIn ? undefined : block.animation, isActive, { opacity, rotation })

  useEffect(() => {
    // La sortie l'emporte sur l'entrée : la diapositive est en train de partir.
    const settings = exiting ? motionOut : motionIn
    if (!settings || !isActive) return
    const el = ref.current
    if (!el) return

    const built = buildTimeline(el, {
      settings,
      rest: { opacity, rotation },
      textElement: textRef.current?.querySelector<HTMLElement>('[data-text-content]') ?? null,
    })
    if (!built) return

    built.timeline.eventCallback('onComplete', built.cleanup)
    return () => {
      built.timeline.kill()
      built.cleanup()
    }
  }, [motionIn, motionOut, exiting, isActive, opacity, rotation])

  const BlockComponent = BLOCKS_REGISTRY[block.type]
  if (!BlockComponent) return null

  // `block` est déjà la version filtrée par viewBlock() (voir renderBlocks plus
  // bas) : hors Ultra, `effects` est déjà vidé, donc rien de plus à vérifier ici.
  const floatFx = block.effects?.float

  return (
    <div
      ref={ref}
      className={styles.blockWrapper}
      style={{
        left: block.x, top: block.y, width: block.width, height: block.height,
        zIndex: block.zIndex ?? 0,
        // Cas sans animation : GSAP ne touche pas l'élément, le style porte tout.
        opacity,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
      }}
    >
      <div
        className={`${floatStyles.floatOuter} ${floatFx ? floatStyles.active : ''}`}
        style={floatFx ? {
          '--float-amplitude': `${floatFx.amplitude}px`,
          '--float-duration': `${floatFx.duration}s`,
        } as React.CSSProperties : undefined}
      >
        <div className={`${floatStyles.floatInner} ${floatFx ? floatStyles.active : ''}`}>
          <EffectLayer block={block}>
            <div ref={textRef} style={{ width: '100%', height: '100%' }}>
              <BlockComponent block={block} onUpdate={() => {}} isEditing={false} onStartEdit={() => {}} onStopEdit={() => {}} />
            </div>
          </EffectLayer>
        </div>
      </div>
    </div>
  )
}

export default function PresentationMode({ slides, onClose, ultra }: Props) {
  const [current, setCurrent] = useState(0)
  // Diapositive en cours de sortie : on laisse les séquences se dérouler avant
  // de basculer, sinon les blocs disparaîtraient d'un coup.
  const [exiting, setExiting] = useState(false)
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Pendant une transition, la diapositive sortante reste montée en même temps
  // que l'entrante : les deux couches s'animent en sens inverse.
  const [outgoing, setOutgoing] = useState<number | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const outgoingRef = useRef<HTMLDivElement>(null)
  const incomingRef = useRef<HTMLDivElement>(null)
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [scale, setScale] = useState(1)
  const [controlsVisible, setControlsVisible] = useState(true)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.electronAPI?.setFullScreen(true)
    return () => {
      window.electronAPI?.setFullScreen(false)
    }
  }, [])

  // ── Scale automatique selon la taille de l'écran
  useEffect(() => {
    const updateScale = () => {
      const el = wrapperRef.current
      if (!el) return
      const availW = el.clientWidth
      const availH = el.clientHeight
      const scaleX = availW / 960
      const scaleY = availH / 540
      setScale(Math.min(scaleX, scaleY))
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  /**
   * Change de diapositive en laissant d'abord jouer les séquences de sortie.
   *
   * Sans cette attente, changer de diapo faisait disparaître les blocs
   * instantanément : les sorties étaient définies mais jamais déclenchées.
   */
  const goTo = useCallback((target: number) => {
    const index = Math.min(Math.max(target, 0), slides.length - 1)
    if (index === current || exitTimer.current || transitionTimer.current) return

    // La transition est portée par la diapositive dans laquelle on ENTRE.
    const settings = slides[index].transition
    const transition = getSlideTransition(settings?.preset)
    // Une transition Ultra reste inerte hors du mode : cohérent avec les effets
    // et les séquences, qui sont eux aussi neutralisés.
    const usable = transition && (ultra || transition.tier === 'basic') ? transition : undefined

    const startTransition = () => {
      if (!usable || usable.duration <= 0) {
        setCurrent(index)
        return
      }
      const seconds = transitionDuration(usable, settings?.speed ?? 1)
      setOutgoing(current)
      setCurrent(index)
      transitionTimer.current = setTimeout(() => {
        transitionTimer.current = null
        setOutgoing(null)
      }, seconds * 1000)
    }

    // Reculer doit rester instantané, y compris en mode Ultra : on ne fait
    // patienter que quand on avance, pour laisser la mise en scène se jouer.
    // Sans ça, revenir en arrière (ex: pour répondre à une question) oblige
    // à subir toute la sortie de la diapo courante avant de basculer.
    const goingForward = index > current
    const wait = ultra && goingForward ? exitDuration(slides[current]) : 0
    if (wait <= 0) {
      startTransition()
      return
    }

    setExiting(true)
    exitTimer.current = setTimeout(() => {
      exitTimer.current = null
      setExiting(false)
      startTransition()
    }, wait * 1000)
  }, [current, slides, ultra])

  // Joue la transition une fois les deux couches montées.
  useEffect(() => {
    if (outgoing === null) return
    const settings = slides[current]?.transition
    const transition = getSlideTransition(settings?.preset)
    if (!transition || !outgoingRef.current || !incomingRef.current) return

    const tween = runSlideTransition({
      outgoing: outgoingRef.current,
      incoming: incomingRef.current,
      transition,
      speed: settings?.speed ?? 1,
    })
    return () => { tween.kill() }
  }, [outgoing, current, slides])

  // Une transition en cours ne doit pas survivre à la fermeture.
  useEffect(() => () => {
    if (exitTimer.current) clearTimeout(exitTimer.current)
    if (transitionTimer.current) clearTimeout(transitionTimer.current)
  }, [])

  // ── Clavier
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') goTo(current + 1)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goTo(current - 1)
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goTo, current, onClose])

  // ── Affichage/masquage des contrôles selon la position de la souris
  const handleMouseMove = (e: React.MouseEvent) => {
    const distanceFromBottom = window.innerHeight - e.clientY

    if (distanceFromBottom <= CONTROLS_REVEAL_ZONE_PX) {
      setControlsVisible(true)
      if (hideTimeout.current) clearTimeout(hideTimeout.current)
    } else {
      // on relance un délai avant de masquer, pour éviter un clignotement
      if (hideTimeout.current) clearTimeout(hideTimeout.current)
      hideTimeout.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_DELAY_MS)
    }
  }

  useEffect(() => {
    return () => {
      if (hideTimeout.current) clearTimeout(hideTimeout.current)
    }
  }, [])

  // ── Navigation par clic : gauche = précédent, droite = suivant
  const handleSlideAreaClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const midpoint = rect.width / 2

    if (clickX < midpoint) goTo(current - 1)
    else goTo(current + 1)
  }

  const slide = slides[current]
  const outgoingSlide = outgoing !== null ? slides[outgoing] : null
  const activeTransition = getSlideTransition(slides[current]?.transition?.preset)
  const needsPerspective = outgoingSlide !== null && activeTransition?.perspective === true

  /** Blocs d'une couche, triés par profondeur. */
  const renderBlocks = (source: typeof slide, active: boolean, isExiting: boolean) =>
    source.blocks
      .slice()
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
      .map(block => (
        <AnimatedBlockWrapper
          key={block.id}
          block={viewBlock(block, ultra)}
          isActive={active}
          exiting={isExiting}
        />
      ))

  return (
    <div className={styles.overlay}>
      <div
        ref={wrapperRef}
        className={styles.slideWrapper}
        onMouseMove={handleMouseMove}
        onClick={handleSlideAreaClick}
      >
        <div
          ref={stageRef}
          className={`${styles.stage} ${needsPerspective ? styles.stagePerspective : ''}`}
          style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
        >
          {/* La couche sortante n'existe que le temps de la transition. Elle est
              rendue en premier pour passer sous l'entrante. */}
          {outgoingSlide && (() => {
            const bg = getSlideBackgroundStyle(outgoingSlide.background, ultra)
            return (
              <div
                ref={outgoingRef}
                className={`${styles.slide} ${bg.animated ? styles.slideBgAnimated : ''}`}
                style={bg.style}
              >
                {renderBlocks(outgoingSlide, true, false)}
              </div>
            )
          })()}
          {(() => {
            const bg = getSlideBackgroundStyle(slide.background, ultra)
            return (
              <div
                // La clé force un remontage à chaque changement : les blocs rejouent
                // ainsi leur séquence d'entrée sur la nouvelle diapositive.
                key={slide.id}
                ref={incomingRef}
                className={`${styles.slide} ${bg.animated ? styles.slideBgAnimated : ''}`}
                style={bg.style}
              >
                {renderBlocks(slide, true, exiting)}
              </div>
            )
          })()}
        </div>
      </div>

      <div
        className={`${styles.controls} ${controlsVisible ? styles.controlsVisible : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <button
          className={styles.btn}
          onClick={() => goTo(current - 1)}
          disabled={current === 0}
        >
          ◀
        </button>
        <span className={styles.counter}>{current + 1} / {slides.length}</span>
        <button
          className={styles.btn}
          onClick={() => goTo(current + 1)}
          disabled={current === slides.length - 1}
        >
          ▶
        </button>
        <button className={`${styles.btn} ${styles.closeBtn}`} onClick={onClose}>
          ✕ Quitter
        </button>
      </div>
    </div>
  )
}