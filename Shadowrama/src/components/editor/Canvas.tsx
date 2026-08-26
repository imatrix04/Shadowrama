import { useRef, useState, useEffect, useCallback } from 'react'
import type { BlockData, MotionPhase } from '../../types'
import Block from './Block'
import styles from './Canvas.module.css'

const CANVAS_W = 960
const CANVAS_H = 540
const SNAP_THRESHOLD = 5
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
}

export default function Canvas({
  blocks, selectedBlockIds, onSelectBlocks, onUpdateBlock, onUpdateBlocks, onCommitBlocks,
  onDeleteBlocks, onGestureStart, ultra, motionPreview,
}: Props) {
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
  const zoomByStep = (step: number) => {
    const el = wrapperRef.current
    if (!el) return
    userAdjustedView.current = true
    const rect = el.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2

    setView(prev => {
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom + step))
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

  const handleBlockMove = (id: number, rawX: number, rawY: number) => {
    const block = blocks.find(b => b.id === id)
    if (!block) return

    const others = blocks.filter(b => b.id !== id)
    const isMultiDrag = selectedBlockIds.includes(id)
    const nonSelectedOthers = isMultiDrag 
      ? others.filter(b => !selectedBlockIds.includes(b.id))
      : others

    let x = rawX
    let y = rawY
    const lines: SnapLine[] = []

    const bCenterX = x + block.width / 2
    const bCenterY = y + block.height / 2
    const bRight = x + block.width
    const bBottom = y + block.height

    const vSources = [
      { val: x, label: 'left' },
      { val: bCenterX, label: 'centerX' },
      { val: bRight, label: 'right' },
    ]

    const hSources = [
      { val: y, label: 'top' },
      { val: bCenterY, label: 'centerY' },
      { val: bBottom, label: 'bottom' },
    ]

    const vTargets: number[] = [
      0, CANVAS_W / 2, CANVAS_W,
      ...nonSelectedOthers.flatMap(b => [b.x, b.x + b.width / 2, b.x + b.width])
    ]
    const hTargets: number[] = [
      0, CANVAS_H / 2, CANVAS_H,
      ...nonSelectedOthers.flatMap(b => [b.y, b.y + b.height / 2, b.y + b.height])
    ]

    for (const src of vSources) {
      for (const target of vTargets) {
        if (Math.abs(src.val - target) < SNAP_THRESHOLD) {
          x += target - src.val
          lines.push({ type: 'v', pos: target })
          break
        }
      }
    }

    for (const src of hSources) {
      for (const target of hTargets) {
        if (Math.abs(src.val - target) < SNAP_THRESHOLD) {
          y += target - src.val
          lines.push({ type: 'h', pos: target })
          break
        }
      }
    }

    setSnapLines(lines)

    const dx = x - block.x
    const dy = y - block.y

    // Tous les blocs entraînés partent dans le même lot : une seule mise à jour
    // par frame, au lieu d'une par bloc sélectionné.
    const updates = [{ id, changes: { x, y } as Partial<BlockData> }]

    if (isMultiDrag) {
      for (const selBlock of blocks) {
        if (selBlock.id === id || !selectedBlockIds.includes(selBlock.id)) continue
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

    const snapTo = (value: number, targets: number[]): number | null => {
      for (const target of targets) {
        if (Math.abs(value - target) < SNAP_THRESHOLD) return target
      }
      return null
    }

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
        <div ref={canvasRef} className={styles.canvas} onClick={handleCanvasClick}>

          {snapLines.map((line, i) => (
            <div
              key={i}
              className={line.type === 'v' ? styles.snapLineV : styles.snapLineH}
              style={line.type === 'v' ? { left: line.pos } : { top: line.pos }}
            />
          ))}

          {[...blocks]
            .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
            .map(block => (
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
              />
            ))}

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

      <div className={styles.zoomControls}>
        <button onClick={() => zoomByStep(-0.1)} className={styles.zoomBtn}>−</button>
        <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => zoomByStep(0.1)} className={styles.zoomBtn}>+</button>
        <button
          onClick={() => {
            // Réinitialisation explicite : on rend la main au recentrage auto.
            userAdjustedView.current = false
            fitToScreen()
          }}
          className={styles.zoomBtn}
          title="Ajuster à l'écran"
        >↺</button>
      </div>
    </div>
  )
}