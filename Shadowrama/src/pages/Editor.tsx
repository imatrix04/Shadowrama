import { useState, useEffect, useCallback } from 'react'
import { BLOCKS_CONFIG } from '../blocks'
import type { BlockData, Slide } from '../types'
import { useEditorHistory } from '../hooks/useEditorHistory'
import { loadDraft, saveDraft } from '../utils/fileManager'
import Canvas from '../components/editor/Canvas'
import Sidebar from '../components/editor/Sidebar'
import TopBar from '../components/editor/TopBar'
import SlidePanel from '../components/editor/SlidePanel'


export default function Editor() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null)
  const [initialDraft] = useState(() => loadDraft())
  const [projectName, setProjectName] = useState<string | null>(initialDraft?.projectName ?? null)

  const { slides, commit, patch, undo, redo, setSlides } = useEditorHistory(
   initialDraft?.slides ?? [{ id: 1, blocks: [] }]
  )

  // ── Ctrl+Z / Ctrl+Shift+Z (redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  // ── Autosave
  useEffect(() => {
    saveDraft(projectName, slides)
  }, [slides, projectName])

  const selectedBlock = slides[currentSlide].blocks.find(b => b.id === selectedBlockId) ?? null

  // ── Slides
  const addSlide = () => {
    commit(prev => [...prev, { id: Date.now(), blocks: [] }])
    setCurrentSlide(slides.length)
  }

  const duplicateSlide = (index: number) => {
    const copy: Slide = {
      id: Date.now(),
      blocks: slides[index].blocks.map(b => ({ ...b, id: Date.now() + Math.random() }))
    }
    commit(prev => {
      const next = [...prev]
      next.splice(index + 1, 0, copy)
      return next
    })
    setCurrentSlide(index + 1)
  }

  const deleteSlide = (index: number) => {
    if (slides.length === 1) return
    commit(prev => prev.filter((_, i) => i !== index))
    setCurrentSlide(prev => Math.min(prev, slides.length - 2))
  }

  // ── Blocks
  const addBlock = (block: Partial<BlockData> & { type: string }) => {
    const config = BLOCKS_CONFIG.find(c => c.type === block.type)
    if (!config) return
    const newBlock = {
      x: 100, y: 100, width: 200, height: 60,
      ...config.defaultProps, ...block,
      id: Date.now(),
      properties: config.properties,
    } as BlockData
    commit(prev => prev.map((s, i) =>
      i === currentSlide ? { ...s, blocks: [...s.blocks, newBlock] } : s
    ))
  }

  const updateBlock = (id: number, changes: Partial<BlockData>) => {
    // Pas de snapshot pendant le drag/resize continu
    patch(prev => prev.map((s, i) =>
      i === currentSlide
        ? { ...s, blocks: s.blocks.map(b => b.id === id ? ({ ...b, ...changes } as BlockData) : b) }
        : s
    ))
  }

  const handleNewProject = () => {
    setSlides([{ id: Date.now(), blocks: [] }])
    setProjectName(null)
    setCurrentSlide(0)
    setSelectedBlockId(null)
  }

  const handleBlockDragEnd = useCallback(() => {
    commit(prev => prev)
  }, [commit])

  const handleDeleteBlock = (id: number) => {
    commit(prev => prev.map((slide, i) =>
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
        onNew={handleNewProject}
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