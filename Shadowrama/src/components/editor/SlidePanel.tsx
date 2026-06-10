import { useState } from 'react'
import type { Slide } from '../../types'

interface Props {
  slides: Slide[]
  currentSlide: number
  onSelectSlide: (index: number) => void
  onAddSlide: () => void
  onDuplicateSlide: (index: number) => void
  onDeleteSlide: (index: number) => void
}

export default function SlidePanel({ slides, currentSlide, onSelectSlide, onAddSlide, onDuplicateSlide, onDeleteSlide }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ display: 'flex', flexShrink: 0, position: 'relative' }}>

      {/* Bouton toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'absolute',
          top: '1rem',
          left: open ? '-16px' : '-28px',
          zIndex: 51,
          width: '28px',
          height: '28px',
          backgroundColor: '#2a2a2a',
          border: '1px solid #444',
          borderRadius: '6px 0 0 6px',
          color: '#aaa',
          cursor: 'pointer',
          fontSize: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'left 0.2s',
        }}
      >
        {open ? '▶' : '◀'}
      </button>

      {/* Panel avec animation */}
      <div style={{
        width: open ? '200px' : '0px',
        overflow: 'hidden',
        transition: 'width 0.2s ease',
        height: '100%',
        backgroundColor: '#111',
        borderLeft: open ? '1px solid #333' : 'none',
        boxSizing: 'border-box',
      }}>
        <div style={{ minWidth: '160px', height: '100%', display: 'flex', flexDirection: 'column', padding: '0.75rem 0.5rem', gap: '0.5rem', boxSizing: 'border-box', overflowY: 'auto' }}>
          <p style={styles.title}>Diapositives</p>
          <div style={styles.list}>
            {slides.map((slide, i) => (
              <div
                key={slide.id}
                style={{ ...styles.thumb, ...(i === currentSlide ? styles.selected : {}) }}
                onClick={() => onSelectSlide(i)}
              >
                <div style={styles.preview}>
                  <span style={styles.previewText}>{i + 1}</span>
                </div>
                <div style={styles.actions}>
                  <button
                    style={btnStyle}
                    title="Dupliquer"
                    onClick={e => { e.stopPropagation(); onDuplicateSlide(i) }}
                  >⧉</button>
                  <button
                    style={{ ...btnStyle, color: slides.length === 1 ? '#555' : '#f66' }}
                    title="Supprimer"
                    disabled={slides.length === 1}
                    onClick={e => { e.stopPropagation(); onDeleteSlide(i) }}
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
          <button style={styles.addBtn} onClick={onAddSlide}>＋ Nouvelle diapo</button>
        </div>
      </div>

    </div>
  )
}

const btnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#aaa',
  cursor: 'pointer',
  fontSize: '0.85rem',
  padding: '2px 5px',
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    margin: '0 0 0.5rem 0',
    color: '#aaa',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    textAlign: 'center',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    flex: 1,
    overflowY: 'auto',
  },
  thumb: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.4rem',
    backgroundColor: '#2a2a3e',
    border: '1px solid #444',
    borderRadius: '6px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  selected: {
    border: '1px solid #6c63ff',
    backgroundColor: '#3a3a5e',
  },
  preview: {
    width: '100%',
    aspectRatio: '16/9',
    backgroundColor: '#1a1a2e',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    color: '#555',
    fontSize: '1.2rem',
    fontWeight: 'bold',
  },
  actions: {
    display: 'flex',
    justifyContent: 'center',
    gap: '4px',
  },
  addBtn: {
    padding: '0.4rem',
    backgroundColor: '#1e1e3a',
    border: '1px dashed #555',
    borderRadius: '6px',
    color: '#6c63ff',
    fontSize: '0.8rem',
    cursor: 'pointer',
    width: '100%',
    flexShrink: 0,
  },
}