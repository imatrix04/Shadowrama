import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BlockData, BlockProperty } from '../../types'

interface Props {
  block: BlockData
  x: number
  y: number
  onUpdate: (id: number, changes: Partial<BlockData>) => void
  onDelete: (id: number) => void
  onReorder: (id: number, direction: 'front' | 'back' | 'forward' | 'backward') => void
  onClose: () => void
}

const inputStyle: React.CSSProperties = {
  padding: '0.35rem',
  backgroundColor: '#2a2a2a',
  border: '1px solid #444',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '0.82rem',
  width: '100%',
  boxSizing: 'border-box',
}

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
  borderBottom: '1px solid #333',
  paddingBottom: '0.5rem',
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#555',
  textTransform: 'uppercase',
  letterSpacing: '1px',
}

const btnStyle: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  backgroundColor: '#2a2a2a',
  border: '1px solid #444',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '0.75rem',
  cursor: 'pointer',
}

function renderField(prop: BlockProperty, block: BlockData, onUpdate: (id: number, changes: Partial<BlockData>) => void) {
  switch (prop.type) {
    case 'number':
      return (
        <input
          type="number"
          style={inputStyle}
          value={block[prop.key] ?? 0}
          onChange={e => onUpdate(block.id, { [prop.key]: Number(e.target.value) })}
        />
      )
    case 'color':
      return (
        <input
          type="color"
          style={{ ...inputStyle, height: '32px', padding: '2px', cursor: 'pointer' }}
          value={block[prop.key] ?? '#ffffff'}
          onChange={e => onUpdate(block.id, { [prop.key]: e.target.value })}
        />
      )
    case 'text':
      return (
        <input
          type="text"
          style={inputStyle}
          value={block[prop.key] ?? ''}
          onChange={e => onUpdate(block.id, { [prop.key]: e.target.value })}
        />
      )
    case 'select':
      return (
        <select
          style={{ ...inputStyle, cursor: 'pointer' }}
          value={block[prop.key] ?? ''}
          onChange={e => onUpdate(block.id, { [prop.key]: e.target.value })}
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
          style={inputStyle}
          value={block[prop.key] ?? 1}
          min={0}
          max={1}
          step={0.05}
          onChange={e => onUpdate(block.id, { [prop.key]: parseFloat(e.target.value) })}
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
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
      <div
        ref={menuRef}
        onWheel={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          zIndex: 100,
          backgroundColor: '#1e1e2e',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '0.75rem',
          width: '180px',
          maxHeight: '320px',
          overflowY: 'auto', 
          minWidth: '200px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Type */}
        <p style={{ margin: 0, ...labelStyle }}>{block.type}</p>

        {/* Section ordre */}
        <div style={sectionStyle}>
          <span style={labelStyle}>Ordre</span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {([
              { label: '⬆️ Premier plan', dir: 'front' },
              { label: '⬇️ Arrière plan', dir: 'back' },
              { label: '↑ Avancer', dir: 'forward' },
              { label: '↓ Reculer', dir: 'backward' },
            ] as const).map(({ label, dir }) => (
              <button
                key={dir}
                style={btnStyle}
                onClick={() => { onReorder(block.id, dir); onClose() }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Propriétés */}
        {properties.map(prop => (
          <div key={prop.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label style={labelStyle}>{prop.label}</label>
            {renderField(prop, block, onUpdate)}
          </div>
        ))}

        <div style={{ borderTop: '1px solid #333', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
          <button
            style={{ ...btnStyle, color: '#ff4d4d', width: '100%' }}
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