import { useState } from 'react'
import type { Slide, SlideTransitionSettings } from '../../types'
import { BLOCKS_REGISTRY } from '../../blocks'
import TransitionPanel from './TransitionPanel'
import Drawer, { DrawerTitle } from '../ui/Drawer'
import type { DrawerTab } from '../ui/Drawer'
import styles from './SlidePanel.module.css'

const TABS: DrawerTab[] = [
  { key: 'slides', label: 'Diapositives', icon: 'slides' },
  { key: 'transitions', label: 'Transitions', icon: 'transition' },
]

interface Props {
  slides: Slide[]
  currentSlide: number
  onSelectSlide: (index: number) => void
  onAddSlide: () => void
  onDuplicateSlide: (index: number) => void
  onDeleteSlide: (index: number) => void
  onReorderSlides: (fromIndex: number, toIndex: number) => void
  /** Le niveau « ultra » des transitions n'est proposé qu'en mode Ultra Design. */
  ultra: boolean
  onSetTransition: (index: number, settings: SlideTransitionSettings | undefined) => void
}

export default function SlidePanel({
  slides,
  currentSlide,
  onSelectSlide,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onReorderSlides,
  ultra,
  onSetTransition,
}: Props) {
  const [openPanel, setOpenPanel] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  function handleDragStart(i: number) {
    setDragIndex(i)
  }

  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    if (i !== dragOverIndex) setDragOverIndex(i)
  }

  function handleDrop(i: number) {
    if (dragIndex !== null && dragIndex !== i) {
      onReorderSlides(dragIndex, i)
    }
    setDragIndex(null)
    setDragOverIndex(null)
  }

  function handleDragEnd() {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  return (
    <Drawer
      side="right"
      tabs={TABS}
      activeTab={openPanel}
      onTabChange={setOpenPanel}
      renderTab={key => key === 'transitions' ? (
        <>
          <DrawerTitle>Transition d'entrée</DrawerTitle>
          <TransitionPanel
            slideIndex={currentSlide}
            current={slides[currentSlide]?.transition}
            ultra={ultra}
            onChange={settings => onSetTransition(currentSlide, settings)}
          />
        </>
      ) : (
        <>
          <DrawerTitle>Diapositives</DrawerTitle>
          <div className={styles.list}>
            {slides.map((slide, i) => (
              <div
                key={slide.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={e => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={handleDragEnd}
                className={`${styles.thumb} ${i === currentSlide ? styles.thumbSelected : ''} ${dragIndex === i ? styles.thumbDragging : ''} ${dragOverIndex === i && dragIndex !== i ? styles.thumbDragOver : ''}`}
                onClick={() => onSelectSlide(i)}
              >
                <div className={styles.thumbPreviewBox}>
                  <div className={styles.thumbPreviewScaler}>
                    {slide.blocks.map(block => {
                      const Renderer = BLOCKS_REGISTRY[block.type]
                      if (!Renderer) return null
                      return (
                        <div
                          key={block.id}
                          className={styles.thumbBlockWrapper}
                          style={{
                            left: block.x, top: block.y,
                            width: block.width, height: block.height,
                            opacity: block.opacity ?? 1,
                            transform: block.rotation ? `rotate(${block.rotation}deg)` : undefined,
                          }}
                        >
                          <Renderer block={block} />
                        </div>
                      )
                    })}
                  </div>
                </div>

                <span className={styles.previewText}>{i + 1}</span>

                <div className={styles.actions}>
                  <button
                    className={styles.actionBtn}
                    title="Dupliquer"
                    onClick={e => { e.stopPropagation(); onDuplicateSlide(i) }}
                  >⧉</button>
                  <button
                    className={`${styles.actionBtn} ${slides.length === 1 ? styles.actionBtnDisabled : styles.actionBtnDanger}`}
                    title="Supprimer"
                    disabled={slides.length === 1}
                    onClick={e => { e.stopPropagation(); onDeleteSlide(i) }}
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
          <button className={styles.addBtn} onClick={onAddSlide}>＋ Nouvelle diapo</button>
        </>
      )}
    />
  )
}