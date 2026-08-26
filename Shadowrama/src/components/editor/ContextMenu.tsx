import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BlockData, BlockProperty, AnimationType } from '../../types'
import { getBlockField, setBlockField } from '../../types'
import { getBlockProperties, getBlockConfig } from '../../blocks'
import Icon from '../ui/Icon'
import styles from './ContextMenu.module.css'
import CustomSelect from '../../styles/CustomSelect'
import { generateMediaKey, registerMedia, resolveMedia } from '../../utils/mediaStore'

// Doivent rester alignés sur les valeurs par défaut de useBlockAnimation.
const DEFAULT_DURATION = 0.6
const DEFAULT_EASE = 'power2.out'

const EASE_OPTIONS = [
  { label: 'Douce (sortie)', value: 'power2.out' },
  { label: 'Douce (entrée/sortie)', value: 'power2.inOut' },
  { label: 'Linéaire', value: 'none' },
  { label: 'Rebond', value: 'back.out(1.7)' },
  { label: 'Élastique', value: 'elastic.out(1, 0.5)' },
]

// Les champs numériques acceptent une saisie vide ou aberrante : on retombe
// sur la valeur par défaut plutôt que d'écrire NaN dans le projet.
function clamp(value: number, min: number, max: number, fallback: number): number {
  if (Number.isNaN(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

interface Props {
  block: BlockData
  x: number
  y: number
  onUpdate: (id: number, changes: Partial<BlockData>) => void
  onDelete: (id: number) => void
  onReorder: (id: number, direction: 'front' | 'back' | 'forward' | 'backward') => void
  /** Ouvre une entrée d'historique avant la première modification d'un champ. */
  onGestureStart: () => void
  onClose: () => void
}

function renderField(prop: BlockProperty, block: BlockData, onUpdate: (id: number, changes: Partial<BlockData>) => void) {
  switch (prop.type) {
    case 'textarea':
      return (
        <textarea
          className={styles.input}
          rows={3}
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
          value={String(getBlockField(block, prop.key) ?? '')}
          onChange={e => onUpdate(block.id, setBlockField(block, prop.key, e.target.value))}
        />
      )
    case 'number':
      return (
        <input
          type="number"
          className={styles.input}
          value={Number(getBlockField(block, prop.key) ?? 0)}
          onChange={e => onUpdate(block.id, setBlockField(block, prop.key, Number(e.target.value)))}
        />
      )
    case 'color': {
      const colorVal = String(getBlockField(block, prop.key) ?? '')
      const isTransparent = !colorVal || colorVal === 'transparent'

      return (
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            type="color"
            className={styles.input}
            style={{ 
              height: '32px', 
              padding: '2px', 
              cursor: 'pointer',
              opacity: isTransparent ? 0.6 : 1 
            }}
            value={isTransparent ? '#ffffff' : colorVal}
            onChange={e => onUpdate(block.id, setBlockField(block, prop.key, e.target.value))}
          />
          {isTransparent && (
            <div style={{
              position: 'absolute',
              inset: '1px',
              pointerEvents: 'none', 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--editor-text)',
              fontSize: '0.85rem',
              backgroundColor: 'var(--editor-btn-bg)',
              borderRadius: 'var(--r-sm)'
            }}>
              transparent
            </div>
          )}
        </div>
      )
    }
    case 'text':
      return (
        <input
          type="text"
          className={styles.input}
          value={String(getBlockField(block, prop.key) ?? '')}
          onChange={e => onUpdate(block.id, setBlockField(block, prop.key, e.target.value))}
        />
      )
    case 'select':
      return (
        <CustomSelect
          value={String(getBlockField(block, prop.key) ?? '')}
          options={prop.options ?? []}
          onChange={v => onUpdate(block.id, setBlockField(block, prop.key, v))}
        />
      )
    case 'float':
      return (
        <input
          type="number"
          className={styles.input}
          value={Number(getBlockField(block, prop.key) ?? 1)}
          min={0}
          max={1}
          step={0.05}
          onChange={e => onUpdate(block.id, setBlockField(block, prop.key, parseFloat(e.target.value)))}
        />
      )
    case 'file': {
      const currentKey = String(getBlockField(block, prop.key) ?? '')
      const previewSrc = currentKey.startsWith('media/') ? resolveMedia(currentKey) : currentKey

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {previewSrc && (
            <img
              src={previewSrc}
              style={{ width: '100%', height: '60px', objectFit: 'cover', borderRadius: '4px' }}
              alt=""
            />
          )}
          <input
            type="file"
            accept="image/*"
            className={styles.input}
            onChange={async e => {
              const file = e.target.files?.[0]
              if (!file) return
              // `arrayBuffer()` remplace le FileReader + découpage de data URL :
              // on garde les octets bruts, sans passer par une chaîne base64
              // 33 % plus grosse qu'il fallait ensuite redécoder.
              const bytes = new Uint8Array(await file.arrayBuffer())
              const key = generateMediaKey(file.name)
              registerMedia(key, bytes, file.type)
              onUpdate(block.id, setBlockField(block, prop.key, key))
            }}
          />
        </div>
      )
    }
    default:
      return null
  }
}

export default function ContextMenu({ block, x, y, onUpdate, onDelete, onReorder, onGestureStart, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  useEffect(() => {
    if (!menuRef.current) return
    const { offsetWidth, offsetHeight } = menuRef.current
    const newX = x + offsetWidth > window.innerWidth ? x - offsetWidth : x
    const newY = y + offsetHeight > window.innerHeight ? y - offsetHeight : y
    setPos({ x: newX, y: newY })
  }, [x, y])

  // Résolues depuis la config du type, pas depuis le bloc : voir BaseBlockData.
  const properties = getBlockProperties(block.type)
  const config = getBlockConfig(block.type)
  const animation = block.animation
  const hasAnimation = !!animation && animation.type !== 'none'

  const updateAnimation = (changes: Partial<NonNullable<BlockData['animation']>>) => {
    onUpdate(block.id, setBlockField(block, 'animation', {
      type: animation?.type ?? 'none',
      ...animation,
      ...changes,
    }))
  }

  return createPortal(
    <>
      <div onClick={onClose} className={styles.backdrop} />
      <div
        ref={menuRef}
        onWheel={e => e.stopPropagation()}
        className={styles.menu}
        style={{ left: pos.x, top: pos.y }}
      >
        {/* Affichait le type brut (« image »). On reprend le libellé et l'icône
            de la config, comme la sidebar. */}
        <p className={styles.typeLabel}>
          {config && <Icon name={config.icon} size={13} />}
          {config?.label ?? block.type}
        </p>

        <div className={styles.section}>
          <span className={styles.sectionLabel}>Ordre</span>
          <div className={styles.orderButtons}>
            {([
              { label: '⬆️ Premier plan', dir: 'front' },
              { label: '⬇️ Arrière plan', dir: 'back' },
              { label: '↑ Avancer', dir: 'forward' },
              { label: '↓ Reculer', dir: 'backward' },
            ] as const).map(({ label, dir }) => (
              <button
                key={dir}
                className={styles.smallBtn}
                onClick={() => { onReorder(block.id, dir); onClose() }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* `onPointerDown`/`onFocus` ouvrent l'entrée d'historique avant la
            première modification : glisser un sélecteur de couleur ne produit
            ainsi qu'un seul « annuler ». */}
        {properties.map(prop => (
          <div
            key={prop.key}
            className={styles.field}
            onPointerDown={onGestureStart}
            onFocus={onGestureStart}
          >
            <label className={styles.fieldLabel}>{prop.label}</label>
            {renderField(prop, block, onUpdate)}
          </div>
        ))}

        <div className={styles.field} onPointerDown={onGestureStart}>
          <label className={styles.fieldLabel}>Animation d'entrée</label>
          <CustomSelect
            value={animation?.type ?? 'none'}
            options={[
              { label: 'Aucune', value: 'none' },
              { label: 'Fondu', value: 'fadeIn' },
              { label: 'Glisse depuis la gauche', value: 'slideInLeft' },
              { label: 'Glisse depuis la droite', value: 'slideInRight' },
              { label: 'Glisse depuis le bas', value: 'slideInUp' },
              { label: 'Zoom', value: 'zoomIn' },
            ]}
            onChange={v => updateAnimation({ type: v as AnimationType })}
          />
        </div>

        {/* Réglages fins : seulement quand une animation est choisie, sinon ils
            n'ont aucun effet visible. Le délai est ce qui permet de faire
            apparaître les blocs d'une diapo en cascade. */}
        {hasAnimation && (
          <>
            <div className={styles.field} onPointerDown={onGestureStart} onFocus={onGestureStart}>
              <label className={styles.fieldLabel}>Durée (s)</label>
              <input
                type="number"
                className={styles.input}
                min={0.1}
                max={5}
                step={0.1}
                value={animation.duration ?? DEFAULT_DURATION}
                onChange={e => updateAnimation({ duration: clamp(parseFloat(e.target.value), 0.1, 5, DEFAULT_DURATION) })}
              />
            </div>
            <div className={styles.field} onPointerDown={onGestureStart} onFocus={onGestureStart}>
              <label className={styles.fieldLabel}>Délai (s)</label>
              <input
                type="number"
                className={styles.input}
                min={0}
                max={10}
                step={0.1}
                value={animation.delay ?? 0}
                onChange={e => updateAnimation({ delay: clamp(parseFloat(e.target.value), 0, 10, 0) })}
              />
            </div>
            <div className={styles.field} onPointerDown={onGestureStart}>
              <label className={styles.fieldLabel}>Courbe</label>
              <CustomSelect
                value={animation.ease ?? DEFAULT_EASE}
                options={EASE_OPTIONS}
                onChange={v => updateAnimation({ ease: v })}
              />
            </div>
          </>
        )}

        <div className={styles.deleteSection}>
          <button
            className={`${styles.smallBtn} ${styles.deleteBtn}`}
            onClick={() => { onDelete(block.id); onClose() }}
          >
            🗑 Supprimer
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}