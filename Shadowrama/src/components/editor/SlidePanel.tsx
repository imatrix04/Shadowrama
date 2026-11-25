import { useEffect, useRef, useState } from 'react'
import type { SlideNumbering, Slide, SlideBackground, SlideTransitionSettings } from '../../types'
import { BLOCKS_REGISTRY } from '../../blocks'
import TransitionPanel from './TransitionPanel'
import BackgroundPanel from './BackgroundPanel'
import NumberingPanel from './NumberingPanel'
import TimingPanel from './TimingPanel'
import { getSlideBackgroundStyle } from '../../ultra/slideBackground'
import Drawer, { DrawerTitle } from '../ui/Drawer'
import Icon from '../ui/Icon'
import type { DrawerTab } from '../ui/Drawer'
import styles from './SlidePanel.module.css'

const TABS: DrawerTab[] = [
  { key: 'slides', label: 'Diapositives', icon: 'slides' },
  { key: 'background', label: 'Arrière-plan', icon: 'background' },
  { key: 'transitions', label: 'Transitions', icon: 'transition' },
  { key: 'timing', label: 'Durée (diaporama auto)', icon: 'clock' },
  { key: 'numbering', label: 'Numérotation', icon: 'hash' },
]

interface Props {
  slides: Slide[]
  currentSlide: number
  onSelectSlide: (index: number) => void
  onAddSlide: () => void
  onDuplicateSlide: (index: number) => void
  onDeleteSlide: (index: number) => void
  onReorderSlides: (fromIndex: number, toIndex: number) => void
  /** Le niveau « ultra » des transitions et fonds n'est proposé qu'en mode Ultra Design. */
  ultra: boolean
  onSetTransition: (index: number, settings: SlideTransitionSettings | undefined) => void
  onSetBackground: (index: number, background: SlideBackground | undefined) => void
  onSetDuration: (index: number, duration: number | undefined) => void
  numbering: SlideNumbering
  onNumberingChange: (numbering: SlideNumbering) => void
  onPreviewNumbering: () => void
  /** Emplacement en bas du rail, pour y loger les contrôles de zoom du canvas. */
  railFooterRef?: (el: HTMLDivElement | null) => void
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
  onSetBackground,
  onSetDuration,
  numbering,
  onNumberingChange,
  onPreviewNumbering,
  railFooterRef,
}: Props) {
  const [openPanel, setOpenPanel] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Garde la diapositive active visible : en naviguant au clavier, en ajoutant
  // ou en dupliquant, elle peut se trouver hors de la zone défilée.
  useEffect(() => {
    listRef.current?.children[currentSlide]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentSlide, openPanel, slides.length])

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
      footerRef={railFooterRef}
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
      ) : key === 'timing' ? (
        <>
          <DrawerTitle>Durée d'affichage</DrawerTitle>
          <TimingPanel
            slideIndex={currentSlide}
            slide={slides[currentSlide]}
            onChange={duration => onSetDuration(currentSlide, duration)}
          />
        </>
      ) : key === 'numbering' ? (
        <>
          <DrawerTitle>Numérotation</DrawerTitle>
          <NumberingPanel
            numbering={numbering}
            ultra={ultra}
            onChange={onNumberingChange}
            onPreview={onPreviewNumbering}
          />
        </>
      ) : key === 'background' ? (
        <>
          <DrawerTitle>Arrière-plan</DrawerTitle>
          <BackgroundPanel
            slideIndex={currentSlide}
            current={slides[currentSlide]?.background}
            ultra={ultra}
            onChange={background => onSetBackground(currentSlide, background)}
          />
        </>
      ) : (
        <>
          <DrawerTitle>
            Diapositives <span className={styles.count}>{slides.length}</span>
          </DrawerTitle>
          <div className={styles.list} ref={listRef}>
            {slides.map((slide, i) => {
              const dropping = dragOverIndex === i && dragIndex !== null && dragIndex !== i
              // Repère d'insertion : avant la cible si on remonte, après si on descend.
              const dropClass = dropping ? (dragIndex! > i ? styles.dropBefore : styles.dropAfter) : ''
              return (
                <div
                  key={slide.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Diapositive ${i + 1}`}
                  aria-current={i === currentSlide ? 'true' : undefined}
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={e => handleDragOver(e, i)}
                  onDrop={() => handleDrop(i)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onSelectSlide(i)}
                  onKeyDown={e => {
                    if (e.target !== e.currentTarget) return
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectSlide(i)
                    }
                  }}
                  className={[
                    styles.thumb,
                    i === currentSlide ? styles.thumbSelected : '',
                    dragIndex === i ? styles.thumbDragging : '',
                    dropClass,
                  ].join(' ')}
                >
                  <div
                    className={styles.thumbPreviewBox}
                    style={getSlideBackgroundStyle(slide.background, ultra).style}
                  >
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

                    <span className={styles.number}>{i + 1}</span>

                    {/* Ce que la diapositive porte au-delà de ses blocs. */}
                    {(slide.transition || slide.background) && (
                      <span className={styles.badges}>
                        {slide.transition && <span title="Transition d'entrée"><Icon name="transition" size={11} /></span>}
                        {slide.background && <span title="Arrière-plan personnalisé"><Icon name="background" size={11} /></span>}
                      </span>
                    )}

                    <span className={styles.actions}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        title="Dupliquer"
                        aria-label={`Dupliquer la diapositive ${i + 1}`}
                        onClick={e => { e.stopPropagation(); onDuplicateSlide(i) }}
                      >
                        <Icon name="copy" size={13} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                        title={slides.length === 1 ? 'Impossible de supprimer la seule diapositive' : 'Supprimer'}
                        aria-label={`Supprimer la diapositive ${i + 1}`}
                        disabled={slides.length === 1}
                        onClick={e => { e.stopPropagation(); onDeleteSlide(i) }}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <button type="button" className={styles.addBtn} onClick={onAddSlide}>
            <Icon name="plus" size={14} /> Nouvelle diapositive
          </button>
        </>
      )}
    />
  )
}