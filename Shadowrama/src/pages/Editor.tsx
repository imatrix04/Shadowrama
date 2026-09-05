import { useState, useEffect, useCallback } from 'react'
import { BLOCKS_CONFIG } from '../blocks'
import type { BlockData, MotionPhase, Slide, SlideBackground, SlideTransitionSettings } from '../types'
import { useEditorHistory } from '../hooks/useEditorHistory'
import { loadDraft, saveDraft } from '../utils/fileManager'
import type { ProjectDraft } from '../utils/fileManager'
import { hydrateMediaStore } from '../utils/mediaStore'
import { readClipboard, writeClipboard } from '../utils/clipboard'
import { nextId } from '../utils/ids'
import { applyBlockUpdates } from '../utils/blockUpdates'
import type { BlockUpdate } from '../utils/blockUpdates'
import { useUltraMode } from '../hooks/useUltraMode'
import { useEditorShortcuts } from '../hooks/useEditorShortcuts'
import Canvas from '../components/editor/Canvas'
import LeftSidebars from '../components/editor/LeftSidebars'
import TopBar from '../components/editor/TopBar'
import SlidePanel from '../components/editor/SlidePanel'

const AUTOSAVE_DELAY_MS = 500
const DUPLICATE_OFFSET = 16

/**
 * Amorçage de l'éditeur.
 *
 * Le brouillon et les médias vivent maintenant dans IndexedDB, dont la lecture
 * est asynchrone. Le montage doit donc attendre : rendre l'éditeur d'abord puis
 * injecter le brouillon écraserait l'état initial de l'historique, et les blocs
 * image lisent le store média PENDANT leur rendu — s'il n'est pas encore
 * reconstruit, ils retombent tous sur le placeholder.
 */
export default function Editor() {
  const [boot, setBoot] = useState<{ draft: ProjectDraft | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([loadDraft(), hydrateMediaStore()])
      .then(([draft]) => { if (!cancelled) setBoot({ draft }) })
      // Un stockage inaccessible ne doit pas bloquer l'éditeur sur son écran de
      // chargement : on démarre alors sur un projet vierge.
      .catch(() => { if (!cancelled) setBoot({ draft: null }) })
    return () => { cancelled = true }
  }, [])

  if (!boot) return <div style={BOOT_STYLE}>Chargement…</div>
  return <EditorView initialDraft={boot.draft} />
}

const BOOT_STYLE: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  height: '100vh', backgroundColor: '#1a1a2e', color: '#fff', opacity: 0.6,
}

function EditorView({ initialDraft }: { initialDraft: ProjectDraft | null }) {
  // Index *demandé*. L'index réellement utilisé est recadré plus bas sur la
  // taille courante de `slides` (voir `currentSlide`).
  const [requestedSlide, setRequestedSlide] = useState(0)
  const [selectedBlockIds, setSelectedBlockIds] = useState<number[]>([])
  const [projectName, setProjectName] = useState<string | null>(initialDraft?.projectName ?? null)
  const [filePath, setFilePath] = useState<string | null>(initialDraft?.filePath ?? null)
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

  // `slides` peut rétrécir sous l'index demandé : annuler l'ajout d'une diapo,
  // refaire une suppression, ou ouvrir un projet plus court. Le recadrage est
  // fait PENDANT le rendu et non dans un effet — un effet ne s'exécute qu'après,
  // et le rendu fautif (`slides[index].blocks` sur un index hors bornes) aurait
  // déjà planté l'éditeur.
  // Le recadrage vaut aussi mémoire : l'index demandé n'est PAS réécrit. Si un
  // « refaire » rétablit les diapositives supprimées, l'utilisateur retrouve
  // celle qu'il regardait, au lieu d'être laissé sur la dernière.
  const currentSlide = Math.min(requestedSlide, slides.length - 1)

  // ── Autosave différé : un déplacement émet une mise à jour par frame, et
  //    sérialiser toutes les diapos à chaque frame saccadait l'édition.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      // L'écriture est asynchrone (IndexedDB) : une autosauvegarde encore en vol
      // au démontage ne doit plus toucher à l'état.
      void saveDraft(projectName, filePath, slides).then(ok => {
        if (!cancelled) setDraftFailed(!ok)
      })
    }, AUTOSAVE_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [slides, projectName, filePath])

  // ── Slides
  const addSlide = () => {
    commit(prev => [...prev, { id: nextId(), blocks: [] }])
    setRequestedSlide(slides.length)
  }

  const duplicateSlide = (index: number) => {
    const source = slides[index]
    const copy: Slide = {
      id: nextId(),
      blocks: source.blocks.map(b => ({ ...structuredClone(b), id: nextId() })),
      transition: source.transition ? structuredClone(source.transition) : undefined,
      background: source.background ? structuredClone(source.background) : undefined,
    }
    commit(prev => {
      const next = [...prev]
      next.splice(index + 1, 0, copy)
      return next
    })
    setRequestedSlide(index + 1)
  }

  const deleteSlide = (index: number) => {
    if (slides.length === 1) return
    commit(prev => prev.filter((_, i) => i !== index))
    setRequestedSlide(prev => {
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

    setRequestedSlide(prevCurrent => {
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
    patch(prev => applyBlockUpdates(prev, currentSlide, [{ id, changes }]))
  }, [patch, currentSlide])

  // Lot de modifications appartenant au même geste (déplacement d'une sélection).
  const updateBlocks = useCallback((updates: BlockUpdate[]) => {
    if (updates.length === 0) return
    patch(prev => applyBlockUpdates(prev, currentSlide, updates))
  }, [patch, currentSlide])

  // Modification atomique hors geste — l'ordre de profondeur, par exemple. Passe
  // par `commit` et non `patch` : sans entrée d'historique, « mettre au premier
  // plan » n'était pas annulable, et un Ctrl+Z remontait par-dessus jusqu'au
  // geste précédent.
  const commitBlocks = useCallback((updates: BlockUpdate[]) => {
    if (updates.length === 0) return
    commit(prev => applyBlockUpdates(prev, currentSlide, updates))
  }, [commit, currentSlide])

  const handleNewProject = () => {
    reset([{ id: nextId(), blocks: [] }])
    setProjectName(null)
    setFilePath(null)
    setRequestedSlide(0)
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
    const slide = slides[currentSlide]
    if (!slide) return

    // Les copies sont calculées AVANT `commit` : l'updater passé à `setState`
    // doit rester pur. React le réinvoque (StrictMode en développement, rendu
    // concurrent ensuite), et remplir un tableau depuis l'intérieur produisait
    // deux fois les copies au second passage.
    const copies = slide.blocks
      .filter(b => ids.includes(b.id))
      .map(b => ({
        ...structuredClone(b),
        id: nextId(),
        x: b.x + DUPLICATE_OFFSET,
        y: b.y + DUPLICATE_OFFSET,
      }))
    if (copies.length === 0) return

    commit(prev => prev.map((s, i) =>
      i === currentSlide ? { ...s, blocks: [...s.blocks, ...copies] } : s
    ))
    setSelectedBlockIds(copies.map(b => b.id))
  }, [slides, commit, currentSlide])

  // ── Presse-papiers
  const copySelection = useCallback((mode: 'copy' | 'cut') => {
    const slide = slides[currentSlide]
    if (!slide) return
    const picked = slide.blocks.filter(b => selectedBlockIds.includes(b.id))
    if (picked.length === 0) return
    writeClipboard(picked, slide.id, mode)
    if (mode === 'cut') handleDeleteBlocks(selectedBlockIds)
  }, [slides, currentSlide, selectedBlockIds, handleDeleteBlocks])

  // Les blocs collés reçoivent de nouveaux identifiants : coller deux fois de
  // suite ne doit pas produire deux blocs qui partagent le même `id`.
  const pasteClipboard = useCallback(() => {
    const slide = slides[currentSlide]
    if (!slide) return
    const payload = readClipboard(slide.id)
    if (!payload) return

    const pasted = payload.blocks.map(b => ({
      ...b,
      id: nextId(),
      x: b.x + payload.shift,
      y: b.y + payload.shift,
    }))
    commit(prev => prev.map((s, i) =>
      i === currentSlide ? { ...s, blocks: [...s.blocks, ...pasted] } : s
    ))
    setSelectedBlockIds(pasted.map(b => b.id))
  }, [slides, currentSlide, commit])

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

  const setSlideBackground = useCallback(
    (index: number, background: SlideBackground | undefined) => {
      commit(prev => prev.map((slide, i) =>
        i === index ? { ...slide, background } : slide
      ))
    },
    [commit],
  )

  const selectAllBlocks = useCallback(() => {
    setSelectedBlockIds(slides[currentSlide]?.blocks.map(b => b.id) ?? [])
  }, [slides, currentSlide])

  // Déplacement au clavier : une seule mise à jour pour toute la sélection, dans
  // un geste déjà ouvert par le raccourci (voir useEditorShortcuts).
  const nudgeSelection = useCallback((dx: number, dy: number) => {
    patch(prev => prev.map((slide, i) =>
      i === currentSlide
        ? {
            ...slide,
            blocks: slide.blocks.map(b =>
              selectedBlockIds.includes(b.id) ? { ...b, x: b.x + dx, y: b.y + dy } : b),
          }
        : slide
    ))
  }, [patch, currentSlide, selectedBlockIds])

  // ── Raccourcis clavier de l'éditeur (liste complète : useEditorShortcuts)
  useEditorShortcuts({
    hasSelection: selectedBlockIds.length > 0,
    undo,
    redo,
    selectAll: selectAllBlocks,
    duplicate: () => duplicateBlocks(selectedBlockIds),
    copy: () => copySelection('copy'),
    cut: () => copySelection('cut'),
    paste: pasteClipboard,
    deleteSelection: () => handleDeleteBlocks(selectedBlockIds),
    nudge: nudgeSelection,
    beginGesture: begin,
  }, !presenting)

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
          setRequestedSlide(0)
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
          ultra={ultra}
          selectedBlock={selectedBlock}
          onUpdateSelected={updateSelectedBlock}
          onGestureStart={begin}
          onPreviewMotion={previewMotion}
        />
        <Canvas
            blocks={slides[currentSlide].blocks}
            background={slides[currentSlide].background}
            selectedBlockIds={selectedBlockIds}
            onSelectBlocks={setSelectedBlockIds}
            onUpdateBlock={updateBlock}
            onUpdateBlocks={updateBlocks}
            onCommitBlocks={commitBlocks}
            onDeleteBlocks={handleDeleteBlocks}
            onGestureStart={begin}
            ultra={ultra}
            motionPreview={motionPreview}
        />
        <SlidePanel
          slides={slides}
          currentSlide={currentSlide}
          onSelectSlide={setRequestedSlide}
          onAddSlide={addSlide}
          onDuplicateSlide={duplicateSlide}
          onDeleteSlide={deleteSlide}
          onReorderSlides={onReorderSlides}
          ultra={ultra}
          onSetTransition={setSlideTransition}
          onSetBackground={setSlideBackground}
        />
      </div>
    </div>
  )
}