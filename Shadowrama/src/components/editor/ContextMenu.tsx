import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BlockData, BlockProperty } from '../../types'
import { getBlockField, setBlockField } from '../../types'
import styles from './ContextMenu.module.css'

interface Props {
  block: BlockData
  x: number
  y: number
  onUpdate: (id: number, changes: Partial<BlockData>) => void
  onDelete: (id: number) => void
  onReorder: (id: number, direction: 'front' | 'back' | 'forward' | 'backward') => void
  onClose: () => void
}

function renderField(prop: BlockProperty, block: BlockData, onUpdate: (id: number, changes: Partial<BlockData>) => void) {
  switch (prop.type) {
    case 'number':
      return (
        <input
          type="number"
          className={styles.input}
          value={Number(getBlockField(block, prop.key) ?? 0)}
          onChange={e => onUpdate(block.id, setBlockField(block, prop.key, Number(e.target.value)))}
        />
      )
    case 'color':
      return (
        <input
          type="color"
          className={`${styles.input} ${styles.inputColor}`}
          value={String(getBlockField(block, prop.key) ?? '#ffffff')}
          onChange={e => onUpdate(block.id, setBlockField(block, prop.key, e.target.value))}
        />
      )
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
        <select
          className={styles.input}
          value={String(getBlockField(block, prop.key) ?? '')}
          onChange={e => onUpdate(block.id, setBlockField(block, prop.key, e.target.value))}
        >
          {prop.options?.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
    default:
      return null
  }
}

export default function ContextMenu({ block, x, y, onUpdate, onDelete, onReorder, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  useEffect(() => {
    if (!menuRef.current) return
    const { offsetWidth, offsetHeight } = menuRef.current
    const newX = x + offsetWidth > window.innerWidth ? x - offsetWidth : x
    const newY = y + offsetHeight > window.innerHeight ? y - offsetHeight : y
    setPos({ x: newX, y: newY })
  }, [x, y])

  const properties = block.properties?.filter(p => p.key !== 'content') ?? []

  return createPortal(
    <>
      <div onClick={onClose} className={styles.backdrop} />
      <div
        ref={menuRef}
        onWheel={e => e.stopPropagation()}
        className={styles.menu}
        style={{ left: pos.x, top: pos.y }}
      >
        <p className={styles.typeLabel}>{block.type}</p>

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

        {properties.map(prop => (
          <div key={prop.key} className={styles.field}>
            <label className={styles.fieldLabel}>{prop.label}</label>
            {renderField(prop, block, onUpdate)}
          </div>
        ))}

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