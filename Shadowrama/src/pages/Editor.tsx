import { useState, useEffect, useCallback } from 'react'
import { BLOCKS_CONFIG } from '../blocks'
import type { AnimationType, BlockData, MotionPhase, Slide, SlideTransitionSettings } from '../types'
import { useEditorHistory } from '../hooks/useEditorHistory'
import { loadDraft, saveDraft } from '../utils/fileManager'
import { hydrateMediaStore } from '../utils/mediaStore'
import { nextId } from '../utils/ids'
import { useUltraMode } from '../hooks/useUltraMode'
import Canvas from '../components/editor/Canvas'
import LeftSidebars from '../components/editor/LeftSidebars'
import TopBar from '../components/editor/TopBar'
import SlidePanel from '../components/editor/SlidePanel'

const AUTOSAVE_DELAY_MS = 500
const DUPLICATE_OFFSET = 16

export default function Editor() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [selectedBlockIds, setSelectedBlockIds] = useState<number[]>([])
  const [initialDraft] = useState(() => loadDraft())
  const [projectName, setProjectName] = useState<string | null>(initialDraft?.projectName ?? null)
  const [filePath, setFilePath] = useState<string | null>(initialDraft?.filePath ?? null)
  // Les blocs image lisent le store média pendant leur rendu : il doit être
  // rechargé depuis IndexedDB avant le premier affichage, sinon les images du
  // brouillon restauré apparaissent vides.
  const [mediaReady, setMediaReady] = useState(false)
  // L'autosauvegarde peut échouer (quota du navigateur saturé) : on le signale
  // dans la barre plutôt que de laisser croire que tout est enregistré.
  const [draftFailed, setDraftFailed] = useState(false)
  const { ultra, toggleUltra } = useUltraMode()
  // Demande d'aperçu d'une séquence. `nonce` permet de rejouer la même phase
  // plusieurs fois de suite : sans lui, deux clics identiques ne changeraient
  // rien et l'animation ne repartirait pas.
  const [motionPreview, setMotionPreview] = useState<{ id: number; phase: MotionPhase; nonce: number } | null>(null)
  // L'état de présentation vit ici et non dans la barre : le canvas doit savoir
  // qu'il ne doit plus réagir au clavier tant qu'on présente.
  const [presenting, setPresenting] = useState(false)

  const { slides, begin, commit, patch, undo, redo, reset, canUndo, canRedo } = useEditorHistory(
    initialDraft?.slides ?? [{ id: nextId(), blocks: [] }]
  )

  useEffect(() => {
    hydrateMediaStore().finally(() => setMediaReady(true))
  }, [])

  // ── Autosave différé : un déplacement émet une mise à jour par frame, et
  //    sérialiser toutes les diapos à chaque frame saccadait l'édition.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDraftFailed(!saveDraft(projectName, filePath, slides))
    }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [slides, projectName, filePath])

  // ── Slides
  const addSlide = () => {
    commit(prev => [...prev, { id: nextId(), blocks: [] }])
    setCurrentSlide(slides.length)
  }

  const duplicateSlide = (index: number) => {
    const copy: Slide = {
      id: nextId(),
      blocks: slides[index].blocks.map(b => ({ ...b, id: nextId() })),
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
    setCurrentSlide(prev => {
      // Supprimer une diapo située avant la courante décale l'index de celle-ci.
      if (index < prev) return prev - 1
      return Math.min(prev, slides.length - 2)
    })
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
      id: nextId(),
    } as BlockData
    commit(prev => prev.map((s, i) =>
      i === currentSlide ? { ...s, blocks: [...s.blocks, newBlock] } : s
    ))
  }

  // État intermédiaire d'un geste : l'entrée d'historique a déjà été ouverte
  // par `begin` au début du geste (voir useEditorHistory).
  const updateBlock = useCallback((id: number, changes: Partial<BlockData>) => {
    patch(prev => prev.map((s, i) =>
      i === currentSlide
        ? { ...s, blocks: s.blocks.map(b => b.id === id ? ({ ...b, ...changes } as BlockData) : b) }
        : s
    ))
  }, [patch, currentSlide])

  const handleNewProject = () => {
    reset([{ id: nextId(), blocks: [] }])
    setProjectName(null)
    setFilePath(null)
    setCurrentSlide(0)
    setSelectedBlockIds([])
  }

  const handleDeleteBlocks = useCallback((ids: number[]) => {
    commit(prev => prev.map((slide, i) =>
      i === currentSlide
        ? { ...slide, blocks: slide.blocks.filter(b => !ids.includes(b.id)) }
        : slide
    ))
    setSelectedBlockIds([])
  }, [commit, currentSlide])

  // Duplique la sélection avec un léger décalage, pour que les copies ne se
  // superposent pas exactement aux originaux.
  const duplicateBlocks = useCallback((ids: number[]) => {
    if (ids.length === 0) return
    const copies: BlockData[] = []
    commit(prev => prev.map((slide, i) => {
      if (i !== currentSlide) return slide
      for (const block of slide.blocks) {
        if (!ids.includes(block.id)) continue
        copies.push({ ...block, id: nextId(), x: block.x + DUPLICATE_OFFSET, y: block.y + DUPLICATE_OFFSET })
      }
      return { ...slide, blocks: [...slide.blocks, ...copies] }
    }))
    setSelectedBlockIds(copies.map(b => b.id))
  }, [commit, currentSlide])

  // Entrer en présentation vide la sélection : les poignées et les raccourcis
  // n'ont plus de sens, et au retour on ne reprend pas sur un bloc oublié.
  const handlePresentingChange = useCallback((value: boolean) => {
    setPresenting(value)
    if (value) setSelectedBlockIds([])
  }, [])

  const setSlideTransition = useCallback(
    (index: number, settings: SlideTransitionSettings | undefined) => {
      commit(prev => prev.map((slide, i) =>
        // Aucune transition ⇒ aucun champ : une diapositive sans réglage reste
        // vierge, et les projets existants ne gagnent pas de données inutiles.
        i === index ? { ...slide, transition: settings } : slide
      ))
    },
    [commit],
  )

  const selectAllBlocks = useCallback(() => {
    setSelectedBlockIds(slides[currentSlide]?.blocks.map(b => b.id) ?? [])
  }, [slides, currentSlide])

  // ── Raccourcis clavier globaux de l'éditeur
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (presenting) return
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return

      // Pendant une saisie, les raccourcis d'édition de texte du navigateur
      // (tout sélectionner, etc.) doivent l'emporter.
      const el = document.activeElement
      const isTyping = el instanceof HTMLElement && (
        el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
      )

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault()
        redo()
      } else if (e.key === 'd' && !isTyping) {
        e.preventDefault()
        duplicateBlocks(selectedBlockIds)
      } else if (e.key === 'a' && !isTyping) {
        e.preventDefault()
        selectAllBlocks()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, duplicateBlocks, selectAllBlocks, selectedBlockIds, presenting])

  // Animation commune à toute la sélection, sinon rien : le panneau ne peut
  // marquer une entrée comme active que si elle vaut pour tous les blocs.
  const currentAnimation = (() => {
    const blocks = slides[currentSlide].blocks.filter(b => selectedBlockIds.includes(b.id))
    if (blocks.length === 0) return null
    const first = blocks[0].animation?.type ?? 'none'
    return blocks.every(b => (b.animation?.type ?? 'none') === first) ? first : null
  })()

  // Les panneaux Ultra travaillent sur un bloc unique : avec plusieurs blocs
  // sélectionnés, on ne saurait pas quoi afficher comme valeurs courantes.
  const selectedBlock = selectedBlockIds.length === 1
    ? slides[currentSlide].blocks.find(b => b.id === selectedBlockIds[0]) ?? null
    : null

  // Accepte une fonction plutôt qu'un objet : les panneaux Ultra composent des
  // objets imbriqués (`effects`, `motion`) à partir de l'existant. Avec un objet
  // figé, deux réglages enchaînés avant le rendu suivant se perdent — le second
  // repartirait d'un `block.effects` périmé.
  const updateSelectedBlock = useCallback(
    (changes: Partial<BlockData> | ((block: BlockData) => Partial<BlockData>)) => {
      if (selectedBlockIds.length !== 1) return
      const id = selectedBlockIds[0]
      patch(prev => prev.map((slide, i) =>
        i === currentSlide
          ? {
              ...slide,
              blocks: slide.blocks.map(b => b.id === id
                ? ({ ...b, ...(typeof changes === 'function' ? changes(b) : changes) } as BlockData)
                : b),
            }
          : slide
      ))
    },
    [selectedBlockIds, patch, currentSlide],
  )

  const previewMotion = useCallback((phase: MotionPhase) => {
    if (selectedBlockIds.length !== 1) return
    setMotionPreview({ id: selectedBlockIds[0], phase, nonce: Date.now() })
  }, [selectedBlockIds])

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
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        draftFailed={draftFailed}
        ultra={ultra}
        onToggleUltra={toggleUltra}
        presenting={presenting}
        onPresentingChange={handlePresentingChange}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <LeftSidebars
          onAddBlock={addBlock}
          onSelectAnimation={handleSelectAnimation}
          selectionCount={selectedBlockIds.length}
          currentAnimation={currentAnimation}
          ultra={ultra}
          selectedBlock={selectedBlock}
          onUpdateSelected={updateSelectedBlock}
          onGestureStart={begin}
          onPreviewMotion={previewMotion}
        />
        {mediaReady && (
          <Canvas
            blocks={slides[currentSlide].blocks}
            selectedBlockIds={selectedBlockIds}
            onSelectBlocks={setSelectedBlockIds}
            onUpdateBlock={updateBlock}
            onDeleteBlocks={handleDeleteBlocks}
            onGestureStart={begin}
            ultra={ultra}
            motionPreview={motionPreview}
            inputsEnabled={!presenting}
          />
        )}
        <SlidePanel
          slides={slides}
          currentSlide={currentSlide}
          onSelectSlide={setCurrentSlide}
          onAddSlide={addSlide}
          onDuplicateSlide={duplicateSlide}
          onDeleteSlide={deleteSlide}
          onReorderSlides={onReorderSlides}
          ultra={ultra}
          onSetTransition={setSlideTransition}
        />
      </div>
    </div>
  )
}
