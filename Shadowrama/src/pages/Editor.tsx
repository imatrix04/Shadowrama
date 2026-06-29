import { useState, useEffect, useCallback } from 'react'
import { BLOCKS_CONFIG } from '../blocks'
import type { AnimationType, BlockData, Slide } from '../types'
import { useEditorHistory } from '../hooks/useEditorHistory'
import { loadDraft, saveDraft } from '../utils/fileManager'
import Canvas from '../components/editor/Canvas'
import LeftSidebars from '../components/editor/LeftSidebars'
import Sidebar from '../components/editor/Sidebar'
import AnimationsSidebar from '../components/editor/AnimationsSidebar'
import TopBar from '../components/editor/TopBar'
import SlidePanel from '../components/editor/SlidePanel'


export default function Editor() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [selectedBlockIds, setSelectedBlockIds] = useState<number[]>([])
  const [initialDraft] = useState(() => loadDraft())
  const [projectName, setProjectName] = useState<string | null>(initialDraft?.projectName ?? null)
  const [filePath, setFilePath] = useState<string | null>(initialDraft?.filePath ?? null)

  const { slides, commit, patch, undo, redo, reset } = useEditorHistory(
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
    saveDraft(projectName, filePath, slides)
  }, [slides, projectName, filePath])



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

  const onReorderSlides = useCallback((fromIndex: number, toIndex: number) => {
    commit(prev => {
      const updated = [...prev]
      const [moved] = updated.splice(fromIndex, 1)
      updated.splice(toIndex, 0, moved)
      return updated
    })

    setCurrentSlide(prevCurrent => {
      if (prevCurrent === fromIndex) return toIndex
      if (fromIndex < prevCurrent && toIndex >= prevCurrent) return prevCurrent - 1
      if (fromIndex > prevCurrent && toIndex <= prevCurrent) return prevCurrent + 1
      return prevCurrent
    })
  }, [commit])

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
    patch(prev => prev.map((s, i) =>
      i === currentSlide
        ? { ...s, blocks: s.blocks.map(b => b.id === id ? ({ ...b, ...changes } as BlockData) : b) }
        : s
    ))
  }

  const handleNewProject = () => {
    reset([{ id: Date.now(), blocks: [] }])
    setProjectName(null)
    setFilePath(null)
    setCurrentSlide(0)
    setSelectedBlockIds([])
  }

  const handleBlockDragEnd = useCallback(() => {
    commit(prev => prev)
  }, [commit])

  const handleDeleteBlocks = (ids: number[]) => {
    commit(prev => prev.map((slide, i) =>
      i === currentSlide
        ? { ...slide, blocks: slide.blocks.filter(b => !ids.includes(b.id)) }
        : slide
    ))
    setSelectedBlockIds([])
  }

  // ── Animations
  const handleSelectAnimation = (type: AnimationType) => {
    if (selectedBlockIds.length === 0) return
    commit(prev => prev.map((slide, i) =>
      i === currentSlide
        ? {
            ...slide,
            blocks: slide.blocks.map(b =>
              selectedBlockIds.includes(b.id)
                ? { ...b, animation: { ...b.animation, type } }
                : b
            ),
          }
        : slide
    ))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#1a1a2e', color: '#fff' }}>
      <TopBar
        slides={slides}
        projectName={projectName}
        setProjectName={setProjectName}
        filePath={filePath}
        setFilePath={setFilePath}
        onLoad={(loaded, name) => {
          reset(loaded)
          setCurrentSlide(0)
          setSelectedBlockIds([])
          setProjectName(name)
        }}
        onNew={handleNewProject}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <LeftSidebars onAddBlock={addBlock} onSelectAnimation={handleSelectAnimation} />
        <Canvas
          blocks={slides[currentSlide].blocks}
          selectedBlockIds={selectedBlockIds}
          onSelectBlocks={setSelectedBlockIds}
          onUpdateBlock={updateBlock}
          onDeleteBlocks={handleDeleteBlocks}
          onBlockDragEnd={handleBlockDragEnd}
        />
        <SlidePanel
          slides={slides}
          currentSlide={currentSlide}
          onSelectSlide={setCurrentSlide}
          onAddSlide={addSlide}
          onDuplicateSlide={duplicateSlide}
          onDeleteSlide={deleteSlide}
          onReorderSlides={onReorderSlides}
        />
      </div>
    </div>
  )
}