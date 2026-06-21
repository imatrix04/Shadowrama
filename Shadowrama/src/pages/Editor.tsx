import { useState, useEffect, useRef, useCallback } from 'react'
import { BLOCKS_CONFIG } from '../blocks'
import type { BlockData, Slide } from '../types'
import Canvas from '../components/editor/Canvas'
import Sidebar from '../components/editor/Sidebar'
import TopBar from '../components/editor/TopBar'
import SlidePanel from '../components/editor/SlidePanel'

const MAX_HISTORY = 50

export default function Editor() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null)
  const [projectName, setProjectName] = useState<string | null>(null)

  const [slides, setSlides] = useState<Slide[]>(() => {
    try {
      const saved = localStorage.getItem('shadowrama-project')
      return saved ? JSON.parse(saved) : [{ id: 1, blocks: [] }]
    } catch {
      return [{ id: 1, blocks: [] }]
    }
  })

  // ── Historique
  const history = useRef<Slide[][]>([])
  const isUndoing = useRef(false)

  // Sauvegarde un snapshot AVANT chaque modification
  const saveSnapshot = useCallback(() => {
    history.current.push(JSON.parse(JSON.stringify(slides)))
    if (history.current.length > MAX_HISTORY) {
      history.current.shift()
    }
  }, [slides])

  // ── Ctrl+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (history.current.length === 0) return
        isUndoing.current = true
        const prev = history.current.pop()!
        setSlides(prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ── Autosave (pas pendant un undo)
  useEffect(() => {
    if (isUndoing.current) {
      isUndoing.current = false
      return
    }
    localStorage.setItem('shadowrama-project', JSON.stringify(slides))
  }, [slides])

  const selectedBlock = slides[currentSlide].blocks.find(b => b.id === selectedBlockId) ?? null

  // ── Slides
  const addSlide = () => {
    saveSnapshot()
    setSlides(prev => [...prev, { id: Date.now(), blocks: [] }])
    setCurrentSlide(slides.length)
  }

  const duplicateSlide = (index: number) => {
    saveSnapshot()
    const copy: Slide = {
      id: Date.now(),
      blocks: slides[index].blocks.map(b => ({ ...b, id: Date.now() + Math.random() }))
    }
    setSlides(prev => {
      const next = [...prev]
      next.splice(index + 1, 0, copy)
      return next
    })
    setCurrentSlide(index + 1)
  }

  const deleteSlide = (index: number) => {
    if (slides.length === 1) return
    saveSnapshot()
    setSlides(prev => prev.filter((_, i) => i !== index))
    setCurrentSlide(prev => Math.min(prev, slides.length - 2))
  }

  // ── Blocks
  const addBlock = (block: Partial<BlockData> & { type: string }) => {
    const config = BLOCKS_CONFIG.find(c => c.type === block.type)
    if (!config) return
    saveSnapshot()
    const newBlock= {
      x: 100, y: 100, width: 200, height: 60,
      ...config.defaultProps, ...block,
      id: Date.now(),
      properties: config.properties,
    } as BlockData
    setSlides(prev => prev.map((s, i) =>
      i === currentSlide ? { ...s, blocks: [...s.blocks, newBlock] } : s
    ))
  }

  const updateBlock = (id: number, changes: Partial<BlockData>) => {
    setSlides(prev => prev.map((s, i) =>
      i === currentSlide
        ? { ...s, blocks: s.blocks.map(b => b.id === id ? ({ ...b, ...changes } as BlockData) : b) }
        : s
    ))
  }

  // Appelé par Canvas quand le drag se termine
  const handleBlockDragEnd = useCallback(() => {
    saveSnapshot()
  }, [saveSnapshot])

  const handleDeleteBlock = (id: number) => {
    saveSnapshot()
    setSlides(prev => prev.map((slide, i) =>
      i === currentSlide
        ? { ...slide, blocks: slide.blocks.filter(b => b.id !== id) }
        : slide
    ))
    setSelectedBlockId(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#1a1a2e', color: '#fff' }}>
      <TopBar
        slides={slides}
        projectName={projectName}
        setProjectName={setProjectName}
        onLoad={(loaded, name) => { setSlides(loaded); setSelectedBlockId(null); setProjectName(name) }}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar onAddBlock={addBlock} />
        <Canvas
          blocks={slides[currentSlide].blocks}
          selectedBlock={selectedBlock}
          onSelectBlock={(block) => setSelectedBlockId(block?.id ?? null)}
          onUpdateBlock={updateBlock}
          onDeleteBlock={handleDeleteBlock}
          onBlockDragEnd={handleBlockDragEnd}
        />
        <SlidePanel
          slides={slides}
          currentSlide={currentSlide}
          onSelectSlide={setCurrentSlide}
          onAddSlide={addSlide}
          onDuplicateSlide={duplicateSlide}
          onDeleteSlide={deleteSlide}
        />
      </div>
    </div>
  )
}