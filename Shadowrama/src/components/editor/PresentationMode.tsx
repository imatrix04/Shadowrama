import { useState, useEffect, useRef } from 'react'
import type { Slide } from '../../types'
import { BLOCKS_REGISTRY } from '../../blocks'

interface Props {
  slides: Slide[]
  onClose: () => void
}

export default function PresentationMode({ slides, onClose }: Props) {
  const [current, setCurrent] = useState(0)
  const [scale, setScale] = useState(1)
  const wrapperRef = useRef<HTMLDivElement>(null)

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

  const slide = slides[current]

  return (
    <div style={styles.overlay}>

      {/* Zone slide */}
      <div ref={wrapperRef} style={styles.slideWrapper}>
        <div style={{
          ...styles.slide,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}>
          {slide.blocks
            .slice()
            .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
            .map(block => {
              const BlockComponent = BLOCKS_REGISTRY[block.type]
              if (!BlockComponent) return null
              return (
                <div
                  key={block.id}
                  style={{
                    position: 'absolute',
                    left: block.x,
                    top: block.y,
                    width: block.width,
                    height: block.height,
                    zIndex: block.zIndex ?? 0,
                    pointerEvents: 'none',
                  }}
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

      {/* Contrôles */}
      <div style={styles.controls}>
        <button style={btnStyle}
          onClick={() => setCurrent(p => Math.max(p - 1, 0))}
          disabled={current === 0}>
          ◀
        </button>
        <span style={{ color: '#aaa', fontSize: '0.85rem' }}>
          {current + 1} / {slides.length}
        </span>
        <button style={btnStyle}
          onClick={() => setCurrent(p => Math.min(p + 1, slides.length - 1))}
          disabled={current === slides.length - 1}>
          ▶
        </button>
        <button style={{ ...btnStyle, marginLeft: '1rem', borderColor: '#ff4444', color: '#ff4444' }}
          onClick={onClose}>
          ✕ Quitter
        </button>
      </div>

    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '0.4rem 0.8rem',
  backgroundColor: '#1a1a1a',
  border: '1px solid #444',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '0.9rem',
  cursor: 'pointer',
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: '#000',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    overflow: 'hidden',
    padding: 0,
  },
  slide: {
    width: '960px',
    height: '540px',
    backgroundColor: '#2d2d2d',
    position: 'relative',
    borderRadius: '8px',
    overflow: 'hidden',
    flexShrink: 0,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem',
    backgroundColor: '#111',
    borderTop: '1px solid #222',
    width: '100%',
    justifyContent: 'center',
    boxSizing: 'border-box',
  },
}