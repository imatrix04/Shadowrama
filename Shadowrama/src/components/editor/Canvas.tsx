import { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { BlockData, MotionPhase, SlideNumbering, SlideBackground } from '../../types'
import Block from './Block'
import ParticleLayer from './ParticleLayer'
import SlideNumber from './SlideNumber'
import { getSlideBackgroundStyle, getSlideParticles } from '../../ultra/slideBackground'
import { snapAxis, nearestTarget } from '../../utils/snapping'
import { boundsOf } from '../../utils/alignment'
import styles from './Canvas.module.css'

const CANVAS_W = 960
const CANVAS_H = 540
// Distance d'attraction en pixels ÉCRAN : divisée par le zoom au moment du calcul.
// En pixels de canvas, elle ne valait que 2,5 px à l'écran à 50 % et 15 px à 300 %.
const SNAP_SCREEN_PX = 6
const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
const FIT_PADDING = 48
// Dimensions minimales d'un bloc, appliquées aussi après magnétisme.
const MIN_BLOCK_W = 40
const MIN_BLOCK_H = 20

interface SnapLine {
  type: 'h' | 'v'
  pos: number
}

interface Props {
  blocks: BlockData[]
  background?: SlideBackground
  numbering: SlideNumbering
  /** Rang de la diapositive affichée et nombre total : le numéro en dépend. */
  slideIndex: number
  slideCount: number
  /** Nonce de l'aperçu de l'animation du numéro (0 = aucun). */
  numberingPreview: number
  selectedBlockIds: number[]
  onSelectBlocks: (ids: number[]) => void
  onUpdateBlock: (id: number, changes: Partial<BlockData>) => void
  /** Lot appartenant au même geste : une seule mise à jour pour toute la sélection. */
  onUpdateBlocks: (updates: { id: number; changes: Partial<BlockData> }[]) => void
  /** Lot atomique laissant une entrée d'historique (ordre de profondeur). */
  onCommitBlocks: (updates: { id: number; changes: Partial<BlockData> }[]) => void
  onDeleteBlocks: (ids: number[]) => void
  /** Ouvre une entrée d'historique avant la première modification d'un geste. */
  onGestureStart: () => void
  ultra: boolean
  /** Aperçu de séquence demandé depuis le panneau Mouvement. */
  motionPreview: { id: number; phase: MotionPhase; nonce: number } | null
  /** Où loger les contrôles de zoom (bas du rail de droite). Sans emplacement,
   *  ils retombent en bandeau flottant au bas du canvas. */
  zoomSlot?: HTMLElement | null
}

/**
 * Pourcentage de zoom éditable : on clique, on tape un nombre, Entrée valide
 * (Échap annule, quitter le champ valide aussi). La valeur est bornée au
 * minimum/maximum du zoom ; un texte illisible rend simplement la main.
 */
function ZoomInput({ zoom, onCommit, className }: {
  zoom: number
  onCommit: (value: number) => void
  className: string
}) {
  const shown = String(Math.round(zoom * 100))
  // null = pas d'édition en cours : le champ affiche le zoom réel (qui bouge
  // avec la molette, les boutons…). Pendant la saisie, on garde le brouillon.
  const [draft, setDraft] = useState<string | null>(null)

  const commit = () => {
    if (draft === null) return
    const n = parseInt(draft, 10)
    if (!Number.isNaN(n)) onCommit(n / 100)
    setDraft(null)
  }

  return (
    <span className={className}>
      <input
        className={styles.zoomInput}
        type="text"
        inputMode="numeric"
        aria-label="Zoom en pourcentage"
        value={draft ?? shown}
        onFocus={e => { setDraft(shown); e.currentTarget.select() }}
        onChange={e => setDraft(e.target.value.replace(/\D/g, '').slice(0, 3))}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur()
          else if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur() }
        }}
      />
      %
    </span>
  )
}

export default function Canvas({
  blocks, background, numbering, slideIndex, slideCount, numberingPreview, selectedBlockIds, onSelectBlocks, onUpdateBlock, onUpdateBlocks, onCommitBlocks,
  onDeleteBlocks, onGestureStart, ultra, motionPreview, zoomSlot,
}: Props) {
  const resolvedBackground = getSlideBackgroundStyle(background, ultra)
  const particles = getSlideParticles(background, ultra)
  const canvasRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ zoom: 1, offset: { x: 0, y: 0 } })
  const { zoom, offset } = view
  // État (et non ref) : la transition CSS du canvas en dépend, or lire une
  // ref pendant le rendu ne déclenche aucune mise à jour.
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0 })
  const [snapLines, setSnapLines] = useState<SnapLine[]>([])
  // Tant que l'utilisateur n'a pas zoomé ni déplacé la vue lui-même, la diapo
  // est recentrée à chaque redimensionnement. Dès qu'il prend la main, on ne
  // touche plus à son cadrage.
  const userAdjustedView = useRef(false)

  const [selectionRect, setSelectionRect] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null)
  const isSelectingArea = useRef(false)
  const selectionStart = useRef({ x: 0, y: 0 })
  const hasDraggedSelection = useRef(false)

  // Un mouseup relâché hors de la fenêtre laissait le panoramique actif
  // indéfiniment : on écoute donc aussi au niveau du document.
  useEffect(() => {
    const stopGestures = () => {
      setIsPanning(false)
      if (isSelectingArea.current) {
        isSelectingArea.current = false
        setSelectionRect(null)
      }
    }
    window.addEventListener('mouseup', stopGestures)
    return () => window.removeEventListener('mouseup', stopGestures)
  }, [])

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    // Convention usuelle des éditeurs graphiques : Ctrl/⌘ + molette zoome,
    // molette seule fait défiler (Maj pour défiler horizontalement).
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      userAdjustedView.current = true

      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        const delta = -e.deltaY * 0.002

        setView(prev => {
          const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom + delta * prev.zoom))
          if (newZoom === prev.zoom) return prev
          return {
            zoom: newZoom,
            offset: {
              x: mouseX - (mouseX - prev.offset.x) * (newZoom / prev.zoom),
              y: mouseY - (mouseY - prev.offset.y) * (newZoom / prev.zoom),
            }
          }
        })
        return
      }

      // Maj inverse les axes, comme dans la plupart des navigateurs, pour
      // permettre un défilement horizontal à la molette verticale.
      const [dx, dy] = e.shiftKey ? [e.deltaY, e.deltaX] : [e.deltaX, e.deltaY]
      setView(prev => ({
        ...prev,
        offset: { x: prev.offset.x - dx, y: prev.offset.y - dy },
      }))
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      setIsPanning(true)
      userAdjustedView.current = true
      panStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }
    } else if (e.button === 0 && (e.target === canvasRef.current || e.target === wrapperRef.current)) {
      e.preventDefault()
      isSelectingArea.current = true
      hasDraggedSelection.current = false
      const rect = canvasRef.current!.getBoundingClientRect()
      const x = (e.clientX - rect.left) / zoom
      const y = (e.clientY - rect.top) / zoom
      selectionStart.current = { x, y }
      setSelectionRect({ x1: x, y1: y, x2: x, y2: y })

      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        onSelectBlocks([])
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setView(prev => ({
        ...prev,
        offset: {
          x: e.clientX - panStart.current.x,
          y: e.clientY - panStart.current.y,
        }
      }))
    } else if (isSelectingArea.current && canvasRef.current) {
      hasDraggedSelection.current = true
      const rect = canvasRef.current.getBoundingClientRect()
      const x = (e.clientX - rect.left) / zoom
      const y = (e.clientY - rect.top) / zoom
      setSelectionRect(prev => prev ? { ...prev, x2: x, y2: y } : null)

      const x1 = Math.min(selectionStart.current.x, x)
      const y1 = Math.min(selectionStart.current.y, y)
      const x2 = Math.max(selectionStart.current.x, x)
      const y2 = Math.max(selectionStart.current.y, y)

      const intersectingIds = blocks
        .filter(b => {
          const bx1 = b.x
          const by1 = b.y
          const bx2 = b.x + b.width
          const by2 = b.y + b.height
          return bx1 < x2 && bx2 > x1 && by1 < y2 && by2 > y1
        })
        .map(b => b.id)

      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        const combined = Array.from(new Set([...selectedBlockIds, ...intersectingIds]))
        onSelectBlocks(combined)
      } else {
        onSelectBlocks(intersectingIds)
      }
    }
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (hasDraggedSelection.current) {
      hasDraggedSelection.current = false
      return
    }
    if (e.target === canvasRef.current && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      onSelectBlocks([])
    }
  }

  const handleReorder = (id: number, direction: 'front' | 'back' | 'forward' | 'backward') => {
    const sorted = [...blocks].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
    const idx = sorted.findIndex(b => b.id === id)
    if (idx === -1) return

    const getZ = (b: BlockData, i: number) => b.zIndex ?? i

    // Un seul lot, donc une seule entrée d'historique : l'échange « avancer » /
    // « reculer » touche deux blocs, et deux mises à jour séparées auraient
    // demandé deux Ctrl+Z pour revenir en arrière.
    if (direction === 'front') {
      const maxZ = Math.max(...blocks.map((b, i) => getZ(b, i)), 0)
      onCommitBlocks([{ id, changes: { zIndex: maxZ + 1 } }])
    } else if (direction === 'back') {
      const minZ = Math.min(...blocks.map((b, i) => getZ(b, i)), 0)
      onCommitBlocks([{ id, changes: { zIndex: minZ - 1 } }])
    } else if (direction === 'forward') {
      if (idx < sorted.length - 1) {
        const nextBlock = sorted[idx + 1]
        const val1 = getZ(sorted[idx], idx)
        const val2 = getZ(nextBlock, idx + 1)
        onCommitBlocks([
          { id: sorted[idx].id, changes: { zIndex: val2 === val1 ? val1 + 1 : val2 } },
          { id: nextBlock.id, changes: { zIndex: val1 } },
        ])
      }
    } else if (direction === 'backward') {
      if (idx > 0) {
        const prevBlock = sorted[idx - 1]
        const val1 = getZ(sorted[idx], idx)
        const val2 = getZ(prevBlock, idx - 1)
        onCommitBlocks([
          { id: sorted[idx].id, changes: { zIndex: val2 === val1 ? val1 - 1 : val2 } },
          { id: prevBlock.id, changes: { zIndex: val1 } },
        ])
      }
    }
  }

  const handleBlockSelect = (block: BlockData, isMultiSelect: boolean) => {
    if (isMultiSelect) {
      if (selectedBlockIds.includes(block.id)) {
        onSelectBlocks(selectedBlockIds.filter(id => id !== block.id))
      } else {
        onSelectBlocks([...selectedBlockIds, block.id])
      }
    } else {
      if (!selectedBlockIds.includes(block.id)) {
        onSelectBlocks([block.id])
      }
    }
  }

  // Le pas est appliqué au zoom courant lu dans le setter : calculer
  // `zoom + 0.1` à l'extérieur repartait de la valeur du dernier rendu, et
  // plusieurs clics rapprochés s'écrasaient les uns les autres.
  const zoomBy = (compute: (current: number) => number) => {
    const el = wrapperRef.current
    if (!el) return
    userAdjustedView.current = true
    const rect = el.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2

    setView(prev => {
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, compute(prev.zoom)))
      if (newZoom === prev.zoom) return prev
      return {
        zoom: newZoom,
        offset: {
          x: cx - (cx - prev.offset.x) * (newZoom / prev.zoom),
          y: cy - (cy - prev.offset.y) * (newZoom / prev.zoom),
        }
      }
    })
  }

  const zoomByStep = (step: number) => zoomBy(current => current + step)
  /** Zoom saisi au clavier : valeur absolue (1 = 100 %), bornée comme le reste. */
  const zoomTo = (value: number) => zoomBy(() => value)

  /**
   * Ajuste la diapositive à la zone visible et la centre.
   *
   * Attention au repère : `.wrapper` centre déjà son contenu en flexbox, sur la
   * base de la taille NON transformée (960×540). La mise à l'échelle part
   * ensuite du coin (`transformOrigin: 0 0`) et fait donc grandir la diapo vers
   * la droite et le bas. Sans compensation, tout zoom supérieur à 100 % ne
   * laisse voir que son coin haut-gauche.
   *
   * Le décalage à appliquer ramène le coin de la diapo agrandie là où il doit
   * être ; les dimensions du conteneur s'annulent dans le calcul :
   *   offset = (taille × (1 − zoom)) / 2
   */
  const fitToScreen = useCallback(() => {
    const el = wrapperRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    if (width === 0 || height === 0) return

    const zoom = Math.min(
      MAX_ZOOM,
      Math.max(
        MIN_ZOOM,
        Math.min((width - FIT_PADDING) / CANVAS_W, (height - FIT_PADDING) / CANVAS_H)
      )
    )
    setView({
      zoom,
      offset: { x: CANVAS_W * (1 - zoom) / 2, y: CANVAS_H * (1 - zoom) / 2 },
    })
  }, [])

  /**
   * Vue ajustée et centrée à l'ouverture.
   *
   * Un simple effet au montage ne suffisait pas : la fenêtre Electron est créée
   * en 1200×800 puis maximisée (voir electron/main.ts). Le cadrage était donc
   * calculé pour la petite taille et jamais repris, laissant la diapo décalée
   * vers le coin haut-gauche. On observe donc les dimensions réelles, et on
   * recentre tant que l'utilisateur n'a pas cadré la vue lui-même.
   */
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    // Ajustement immédiat : couvre le cas normal sans attendre l'observateur.
    fitToScreen()

    // Puis on suit les changements de taille, pour le passage en plein écran
    // comme pour un redimensionnement manuel de la fenêtre.
    const observer = new ResizeObserver(() => {
      if (!userAdjustedView.current) fitToScreen()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [fitToScreen])

  // Alt maintenu = pas de magnétisme. Suivi par une ref : lu à chaque mouvement
  // de souris, sans provoquer de rendu.
  const altHeld = useRef(false)
  useEffect(() => {
    const sync = (e: KeyboardEvent) => { altHeld.current = e.altKey }
    const release = () => { altHeld.current = false }
    window.addEventListener('keydown', sync)
    window.addEventListener('keyup', sync)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keydown', sync)
      window.removeEventListener('keyup', sync)
      window.removeEventListener('blur', release)
    }
  }, [])

  const handleBlockMove = (id: number, rawX: number, rawY: number) => {
    const block = blocks.find(b => b.id === id)
    if (!block) return

    const isMultiDrag = selectedBlockIds.includes(id)
    const moving = isMultiDrag ? blocks.filter(b => selectedBlockIds.includes(b.id)) : [block]
    const fixed = blocks.filter(b => !moving.some(m => m.id === b.id))

    let x = rawX
    let y = rawY
    let lines: SnapLine[] = []

    // Maintenir Alt coupe le magnétisme, pour placer au pixel près.
    if (!altHeld.current) {
      // Ce sont les bords de TOUT ce qui bouge (l'enveloppe de la sélection) qui
      // s'aimantent, pas seulement ceux du bloc saisi.
      const shiftX = rawX - block.x
      const shiftY = rawY - block.y
      const bounds = boundsOf(moving.map(m => ({ ...m, x: m.x + shiftX, y: m.y + shiftY })))
      const threshold = SNAP_SCREEN_PX / zoom

      const vTargets = [0, CANVAS_W / 2, CANVAS_W, ...fixed.flatMap(b => [b.x, b.x + b.width / 2, b.x + b.width])]
      const hTargets = [0, CANVAS_H / 2, CANVAS_H, ...fixed.flatMap(b => [b.y, b.y + b.height / 2, b.y + b.height])]

      const snapX = snapAxis([bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width], vTargets, threshold)
      const snapY = snapAxis([bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height], hTargets, threshold)

      x += snapX.delta
      y += snapY.delta
      lines = [
        ...snapX.guides.map(pos => ({ type: 'v' as const, pos })),
        ...snapY.guides.map(pos => ({ type: 'h' as const, pos })),
      ]
    }

    setSnapLines(lines)

    const dx = x - block.x
    const dy = y - block.y

    // Tous les blocs entraînés partent dans le même lot : une seule mise à jour
    // par frame, au lieu d'une par bloc sélectionné.
    const updates = [{ id, changes: { x, y } as Partial<BlockData> }]

    if (isMultiDrag) {
      for (const selBlock of moving) {
        if (selBlock.id === id) continue
        updates.push({ id: selBlock.id, changes: { x: selBlock.x + dx, y: selBlock.y + dy } })
      }
    }

    onUpdateBlocks(updates)
  }

  /**
   * Magnétisme au redimensionnement : seuls les bords effectivement tirés sont
   * aimantés. Le déplacement en bénéficiait déjà, pas le redimensionnement, ce
   * qui rendait impossible d'aligner proprement deux blocs par leurs bords.
   */
  const handleBlockResize = (id: number, changes: Partial<BlockData>) => {
    const block = blocks.find(b => b.id === id)
    if (!block) return

    const others = blocks.filter(b => b.id !== id)
    const vTargets = [
      0, CANVAS_W / 2, CANVAS_W,
      ...others.flatMap(b => [b.x, b.x + b.width / 2, b.x + b.width]),
    ]
    const hTargets = [
      0, CANVAS_H / 2, CANVAS_H,
      ...others.flatMap(b => [b.y, b.y + b.height / 2, b.y + b.height]),
    ]

    const threshold = SNAP_SCREEN_PX / zoom
    const snapTo = (value: number, targets: number[]): number | null =>
      altHeld.current ? null : nearestTarget(value, targets, threshold)

    const next = { ...block, ...changes } as BlockData
    const lines: SnapLine[] = []

    // `x` modifié ⇒ le bord gauche bouge ; sinon c'est le bord droit.
    if (changes.x !== undefined) {
      const snapped = snapTo(next.x, vTargets)
      if (snapped !== null) {
        const right = next.x + next.width
        next.x = Math.min(snapped, right - MIN_BLOCK_W)
        next.width = right - next.x
        lines.push({ type: 'v', pos: snapped })
      }
    } else if (changes.width !== undefined) {
      const snapped = snapTo(next.x + next.width, vTargets)
      if (snapped !== null) {
        next.width = Math.max(MIN_BLOCK_W, snapped - next.x)
        lines.push({ type: 'v', pos: snapped })
      }
    }

    if (changes.y !== undefined) {
      const snapped = snapTo(next.y, hTargets)
      if (snapped !== null) {
        const bottom = next.y + next.height
        next.y = Math.min(snapped, bottom - MIN_BLOCK_H)
        next.height = bottom - next.y
        lines.push({ type: 'h', pos: snapped })
      }
    } else if (changes.height !== undefined) {
      const snapped = snapTo(next.y + next.height, hTargets)
      if (snapped !== null) {
        next.height = Math.max(MIN_BLOCK_H, snapped - next.y)
        lines.push({ type: 'h', pos: snapped })
      }
    }

    setSnapLines(lines)
    onUpdateBlock(id, { x: next.x, y: next.y, width: next.width, height: next.height })
  }

  const handleBlockDragEnd = () => {
    setSnapLines([])
  }

  // Dans le rail : colonne compacte, « + » en haut. Sans emplacement : l'ancien
  // bandeau horizontal flottant.
  const inRail = !!zoomSlot
  const zoomControls = (
    <div className={inRail ? styles.zoomRail : styles.zoomControls}>
      <button
        onClick={() => zoomByStep(inRail ? 0.1 : -0.1)}
        className={styles.zoomBtn}
        title={inRail ? 'Zoom avant' : 'Zoom arrière'}
        aria-label={inRail ? 'Zoom avant' : 'Zoom arrière'}
      >{inRail ? '+' : '−'}</button>
      <ZoomInput zoom={zoom} onCommit={zoomTo} className={styles.zoomLabel} />
      <button
        onClick={() => zoomByStep(inRail ? -0.1 : 0.1)}
        className={styles.zoomBtn}
        title={inRail ? 'Zoom arrière' : 'Zoom avant'}
        aria-label={inRail ? 'Zoom arrière' : 'Zoom avant'}
      >{inRail ? '−' : '+'}</button>
      <button
        onClick={() => {
          // Réinitialisation explicite : on rend la main au recentrage auto.
          userAdjustedView.current = false
          fitToScreen()
        }}
        className={styles.zoomBtn}
        title="Ajuster à l'écran"
        aria-label="Ajuster à l'écran"
      >↺</button>
    </div>
  )

  return (
    <div
      ref={wrapperRef}
      className={styles.wrapper}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
    >
      <div style={{
        transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
        transformOrigin: '0 0',
        transition: isPanning ? 'none' : 'transform 0.05s',
      }}>
                <div
          ref={canvasRef}
          className={`${styles.canvas} ${resolvedBackground.animated ? styles.canvasBgAnimated : ''}`}
          style={resolvedBackground.style}
          onClick={handleCanvasClick}
        >
          {/* En premier enfant : la couche reste sous les blocs sans avoir à
              jouer sur leur z-index. */}
          <ParticleLayer settings={particles} interactive />

          {snapLines.map((line, i) => (
            <div
              key={i}
              className={line.type === 'v' ? styles.snapLineV : styles.snapLineH}
              style={line.type === 'v' ? { left: line.pos } : { top: line.pos }}
            />
          ))}

          {[...blocks]
            .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
            .map((block, layerIndex) => (
              <Block
                key={block.id}
                block={block}
                isSelected={selectedBlockIds.includes(block.id)}
                zoom={zoom}
                onSelect={handleBlockSelect}
                onUpdate={onUpdateBlock}
                onResize={handleBlockResize}
                onMove={handleBlockMove}
                onDragEnd={handleBlockDragEnd}
                onGestureStart={onGestureStart}
                ultra={ultra}
                motionPreview={motionPreview?.id === block.id ? motionPreview : null}
                onDelete={(id) => onDeleteBlocks([id])}
                onReorder={handleReorder}
                layerIndex={layerIndex + 1}
                layerCount={blocks.length}
              />
            ))}

          <SlideNumber
            index={slideIndex}
            total={slideCount}
            numbering={numbering}
            background={background}
            ultra={ultra}
            playKey={numberingPreview}
          />

          {selectionRect && (
            <div style={{
              position: 'absolute',
              left: Math.min(selectionRect.x1, selectionRect.x2),
              top: Math.min(selectionRect.y1, selectionRect.y2),
              width: Math.abs(selectionRect.x1 - selectionRect.x2),
              height: Math.abs(selectionRect.y1 - selectionRect.y2),
              border: '1.5px dashed #6c63ff',
              backgroundColor: 'rgba(108, 99, 255, 0.12)',
              pointerEvents: 'none',
              zIndex: 10000,
            }} />
          )}
        </div>
      </div>

      {zoomSlot ? createPortal(zoomControls, zoomSlot) : zoomControls}
    </div>
  )
}