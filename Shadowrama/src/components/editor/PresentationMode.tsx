import { useState, useEffect, useRef } from 'react'
import type { Slide } from '../../types'
import { BLOCKS_REGISTRY } from '../../blocks'
import styles from './PresentationMode.module.css'

interface Props {
  slides: Slide[]
  onClose: () => void
}

const CONTROLS_REVEAL_ZONE_PX = 80 // distance depuis le bas de l'écran qui révèle les contrôles
const CONTROLS_HIDE_DELAY_MS = 1500

export default function PresentationMode({ slides, onClose }: Props) {
  const [current, setCurrent] = useState(0)
  const [scale, setScale] = useState(1)
  const [controlsVisible, setControlsVisible] = useState(true)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // ── Clavier
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        setCurrent(prev => Math.min(prev + 1, slides.length - 1))
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setCurrent(prev => Math.max(prev - 1, 0))
      }
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [slides.length, onClose])

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

    if (clickX < midpoint) {
      setCurrent(prev => Math.max(prev - 1, 0))
    } else {
      setCurrent(prev => Math.min(prev + 1, slides.length - 1))
    }
  }

  const slide = slides[current]

  return (
    <div className={styles.overlay}>
      <div
        ref={wrapperRef}
        className={styles.slideWrapper}
        onMouseMove={handleMouseMove}
        onClick={handleSlideAreaClick}
      >
        <div className={styles.slide} style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
          {slide.blocks
            .slice()
            .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
            .map(block => {
              const BlockComponent = BLOCKS_REGISTRY[block.type]
              if (!BlockComponent) return null
              return (
                <div
                  key={block.id}
                  className={styles.blockWrapper}
                  style={{ left: block.x, top: block.y, width: block.width, height: block.height, zIndex: block.zIndex ?? 0 }}
                >
                  <BlockComponent
                    block={block}
                    onUpdate={() => {}}
                    isEditing={false}
                    onStartEdit={() => {}}
                    onStopEdit={() => {}}
                  />
                </div>
              )
            })}
        </div>
      </div>

      <div
        className={`${styles.controls} ${controlsVisible ? styles.controlsVisible : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <button
          className={styles.btn}
          onClick={() => setCurrent(p => Math.max(p - 1, 0))}
          disabled={current === 0}
        >
          ◀
        </button>
        <span className={styles.counter}>{current + 1} / {slides.length}</span>
        <button
          className={styles.btn}
          onClick={() => setCurrent(p => Math.min(p + 1, slides.length - 1))}
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