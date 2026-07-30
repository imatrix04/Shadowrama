import { useRef, useState, useEffect } from 'react'
import type { BlockData, MotionPhase } from '../../types'
import { BLOCKS_REGISTRY } from '../../blocks'
import { EffectLayer } from '../../ultra/effects'
import { buildTimeline, gsapReset } from '../../ultra/timeline'
import ContextMenu from './ContextMenu'

interface Props {
  block: BlockData
  isSelected: boolean
  /** Facteur de zoom du canvas : les deltas souris sont en pixels écran,
   *  les coordonnées des blocs en pixels canvas. */
  zoom: number
  onSelect: (block: BlockData, isMultiSelect: boolean) => void
  onUpdate: (id: number, changes: Partial<BlockData>) => void
  onDelete: (id: number) => void
  onMove: (id: number, x: number, y: number) => void
  /** Redimensionnement : passe par le Canvas, qui applique le magnétisme. */
  onResize: (id: number, changes: Partial<BlockData>) => void
  onDragEnd: () => void
  /** Ouvre une entrée d'historique avant la première modification d'un geste. */
  onGestureStart: () => void
  onReorder: (id: number, direction: 'front' | 'back' | 'forward' | 'backward') => void
  ultra: boolean
  /** Non nul quand un aperçu de séquence est demandé pour CE bloc. */
  motionPreview: { phase: MotionPhase; nonce: number } | null
}

const MIN_W = 40
const MIN_H = 20

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const HANDLES: { dir: ResizeHandle; style: React.CSSProperties }[] = [
  { dir: 'n',  style: { top: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize',  width: 8, height: 8 } },
  { dir: 's',  style: { bottom: -4, left: '50%', transform: 'translateX(-50%)', cursor: 's-resize', width: 8, height: 8 } },
  { dir: 'e',  style: { right: -4, top: '50%', transform: 'translateY(-50%)', cursor: 'e-resize',  width: 8, height: 8 } },
  { dir: 'w',  style: { left: -4, top: '50%', transform: 'translateY(-50%)', cursor: 'w-resize',   width: 8, height: 8 } },
  { dir: 'ne', style: { top: -4, right: -4, cursor: 'ne-resize', width: 8, height: 8 } },
  { dir: 'nw', style: { top: -4, left: -4, cursor: 'nw-resize', width: 8, height: 8 } },
  { dir: 'se', style: { bottom: -4, right: -4, cursor: 'se-resize', width: 8, height: 8 } },
  { dir: 'sw', style: { bottom: -4, left: -4, cursor: 'sw-resize', width: 8, height: 8 } },
]

export default function Block({
  block, isSelected, zoom, onSelect, onUpdate, onDelete, onMove, onResize, onDragEnd, onGestureStart, onReorder,
  ultra, motionPreview,
}: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const isDragging = useRef(false)
  const isResizing = useRef(false)
  // L'entrée d'historique n'est ouverte qu'au premier mouvement réel : un simple
  // clic de sélection ne doit pas produire un « annuler » qui ne change rien.
  const gestureOpened = useRef(false)
  const resizeDir = useRef<ResizeHandle | null>(null)
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0, bx: 0, by: 0 })
  const offset = useRef({ x: 0, y: 0 })
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const BlockComponent = BLOCKS_REGISTRY[block.type]

  // Couche dédiée au mouvement : GSAP y écrit `transform` et `filter`. La couche
  // d'effets est en dessous, sinon une animation de flou effacerait les ombres.
  const motionRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)

  // Aperçu depuis le panneau Mouvement. On dépend du `nonce` pour pouvoir
  // rejouer la même phase plusieurs fois d'affilée.
  const nonce = motionPreview?.nonce
  const phase = motionPreview?.phase
  useEffect(() => {
    if (!nonce || !phase) return
    const el = motionRef.current
    const settings = block.motion?.[phase]
    if (!el || !settings) return

    const built = buildTimeline(el, {
      settings,
      rest: { opacity: block.opacity ?? 1, rotation: 0 },
      textElement: textRef.current?.querySelector<HTMLElement>('[data-text-content]') ?? null,
    })
    if (!built) return

    // L'aperçu ne doit rien laisser derrière lui : on remet l'état de repos et
    // on recolle le texte découpé.
    built.timeline.eventCallback('onComplete', () => {
      built.cleanup()
      gsapReset(el, block.opacity ?? 1)
    })

    return () => {
      built.timeline.kill()
      built.cleanup()
      gsapReset(el, block.opacity ?? 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, phase])

  const openGestureOnce = () => {
    if (gestureOpened.current) return
    gestureOpened.current = true
    onGestureStart()
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return
    e.stopPropagation()
    const isMultiSelect = e.shiftKey || e.ctrlKey || e.metaKey
    onSelect(block, isMultiSelect)
    isDragging.current = true
    gestureOpened.current = false
    // On divise par le zoom pour repasser en coordonnées canvas : sans ça, un
    // bloc suit la souris à la mauvaise vitesse dès que le zoom n'est pas à 100 %.
    offset.current = { x: e.clientX / zoom - block.x, y: e.clientY / zoom - block.y }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      openGestureOnce()
      onMove(block.id, e.clientX / zoom - offset.current.x, e.clientY / zoom - offset.current.y)
    }

    const handleMouseUp = () => {
      isDragging.current = false
      onDragEnd()
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleResizeMouseDown = (e: React.MouseEvent, dir: ResizeHandle) => {
    e.preventDefault()
    e.stopPropagation()
    isResizing.current = true
    gestureOpened.current = false
    resizeDir.current = dir
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      w: block.width,
      h: block.height,
      bx: block.x,
      by: block.y,
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      openGestureOnce()

      // Le déplacement de souris est en repère écran. Si le bloc est pivoté, on
      // le ramène dans son propre repère, sinon tirer une poignée agrandit le
      // bloc dans une direction qui ne correspond pas au geste.
      const rawDx = (e.clientX - resizeStart.current.x) / zoom
      const rawDy = (e.clientY - resizeStart.current.y) / zoom
      const angle = -(block.rotation ?? 0) * Math.PI / 180
      const dx = rawDx * Math.cos(angle) - rawDy * Math.sin(angle)
      const dy = rawDx * Math.sin(angle) + rawDy * Math.cos(angle)

      const dir = resizeDir.current!
      const start = resizeStart.current
      const changes: Partial<BlockData> = {}

      if (dir.includes('e')) changes.width  = Math.max(MIN_W, start.w + dx)
      if (dir.includes('s')) changes.height = Math.max(MIN_H, start.h + dy)
      if (dir.includes('w')) {
        changes.width = Math.max(MIN_W, start.w - dx)
        changes.x     = start.bx + start.w - changes.width
      }
      if (dir.includes('n')) {
        changes.height = Math.max(MIN_H, start.h - dy)
        changes.y      = start.by + start.h - changes.height
      }

      // Maj enfoncée : conserve les proportions d'origine. Indispensable pour
      // les images, qui se déformaient au moindre coin tiré.
      if (e.shiftKey && start.h > 0) {
        const ratio = start.w / start.h
        const w = changes.width ?? start.w
        const h = changes.height ?? start.h
        // On suit l'axe le plus sollicité pour éviter les à-coups.
        if (Math.abs(w - start.w) >= Math.abs(h - start.h)) {
          changes.width = w
          changes.height = Math.max(MIN_H, w / ratio)
        } else {
          changes.height = h
          changes.width = Math.max(MIN_W, h * ratio)
        }
        // Les bords haut/gauche restent ancrés sur le coin opposé.
        if (dir.includes('w')) changes.x = start.bx + start.w - (changes.width ?? start.w)
        if (dir.includes('n')) changes.y = start.by + start.h - (changes.height ?? start.h)
      }

      onResize(block.id, changes)
    }

    const handleMouseUp = () => {
      isResizing.current = false
      resizeDir.current = null
      onDragEnd()
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      style={{
        position: 'absolute',
        left: block.x,
        top: block.y,
        width: block.width,
        height: block.height,
        outline: isSelected && !isEditing ? '2px solid var(--accent)' : '2px solid transparent',
        cursor: isEditing ? 'text' : 'grab',
        userSelect: isEditing ? 'text' : 'none',
        boxSizing: 'border-box',
        zIndex: block.zIndex,
        opacity: block.opacity ?? 1,
        // Pivot au centre : les poignées tournent avec le bloc, et le
        // redimensionnement compense l'angle (voir handleResizeMouseDown).
        transform: block.rotation ? `rotate(${block.rotation}deg)` : undefined,
      }}
    >
      {BlockComponent && (
        <div ref={motionRef} style={{ width: '100%', height: '100%' }}>
        <EffectLayer block={ultra ? block : { ...block, effects: undefined }}>
        <div ref={textRef} style={{ width: '100%', height: '100%' }}>
        <BlockComponent
          block={block}
          onUpdate={onUpdate}
          isEditing={isEditing}
          onStartEdit={() => {
            // Toute la session de saisie ne forme qu'une seule entrée d'historique.
            onGestureStart()
            setIsEditing(true)
          }}
          onStopEdit={() => setIsEditing(false)}
        />
        </div>
        </EffectLayer>
        </div>
      )}

      {isSelected && !isEditing && HANDLES.map(({ dir, style }) => (
        <div
          key={dir}
          onMouseDown={e => handleResizeMouseDown(e, dir)}
          style={{
            position: 'absolute',
            width: 8,
            height: 8,
            backgroundColor: '#6c63ff',
            border: '1.5px solid #fff',
            borderRadius: '2px',
            zIndex: 10,
            ...style,
          }}
        />
      ))}

      {contextMenu && (
        <ContextMenu
          block={block}
          x={contextMenu.x}
          y={contextMenu.y}
          onUpdate={onUpdate}
          onGestureStart={onGestureStart}
          onReorder={onReorder}
          onDelete={onDelete}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
