import { useRef, useEffect, useState } from 'react'
import type { BlockData, BlockProperty } from '../../types'

interface Props {
  block: BlockData
  x: number
  y: number
  onUpdate: (id: number, changes: Partial<BlockData>) => void
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
    default:
      return null
  }
}

export default function ContextMenu({ block, x, y, onUpdate, onClose }: Props) {
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

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
      <div
        ref={menuRef}
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          zIndex: 100,
          backgroundColor: '#1e1e2e',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '0.75rem',
          minWidth: '200px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.7rem', color: '#555', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {block.type}
        </p>
        {properties.map(prop => (
          <div key={prop.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label style={{ fontSize: '0.72rem', color: '#888' }}>{prop.label}</label>
            {renderField(prop, block, onUpdate)}
          </div>
        ))}
      </div>
    </>
  )
}