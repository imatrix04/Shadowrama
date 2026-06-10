import { useState, useEffect } from 'react'
import { BLOCKS_CONFIG } from '../blocks'
import type { BlockData, Slide } from '../types'
import Canvas from '../components/editor/Canvas'
import Sidebar from '../components/editor/Sidebar'
import TopBar from '../components/editor/TopBar'
import SlidePanel from '../components/editor/SlidePanel'

export default function Editor() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null)
  const [projectName, setProjectName] = useState<string | null>(null)

  const addSlide = () => {
  setSlides(prev => [...prev, { id: Date.now(), blocks: [] }])
  setCurrentSlide(slides.length) // pointe sur la nouvelle
  }

  const duplicateSlide = (index: number) => {
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
    setSlides(prev => prev.filter((_, i) => i !== index))
    setCurrentSlide(prev => Math.min(prev, slides.length - 2))
  }

  const [slides, setSlides] = useState<Slide[]>(() => {
    try {
      const saved = localStorage.getItem('shadowrama-project')
      return saved ? JSON.parse(saved) : [{ id: 1, blocks: [] }]
    } catch {
      return [{ id: 1, blocks: [] }]
    }
  })

  // Ajoute ce useEffect pour sauvegarder automatiquement :
  useEffect(() => {
    localStorage.setItem('shadowrama-project', JSON.stringify(slides))
  }, [slides])

  const selectedBlock = slides[currentSlide].blocks.find(b => b.id === selectedBlockId) ?? null

  const addBlock = (block: Partial<BlockData> & { type: string }) => {
    const config = BLOCKS_CONFIG.find(c => c.type === block.type)
    if (!config) return
    const newBlock: BlockData = {
      x: 100, y: 100, width: 200, height: 60,
      ...config.defaultProps, ...block,
      id: Date.now(),
      properties: config.properties,
    }
    setSlides(prev => prev.map((s, i) =>
      i === currentSlide ? { ...s, blocks: [...s.blocks, newBlock] } : s
    ))
  }

  const updateBlock = (id: number, changes: Partial<BlockData>) => {
    setSlides(prev => prev.map((s, i) =>
      i === currentSlide
        ? { ...s, blocks: s.blocks.map(b => b.id === id ? { ...b, ...changes } : b) }
        : s
    ))
  }

  const handleDeleteBlock = (id: number) => {
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