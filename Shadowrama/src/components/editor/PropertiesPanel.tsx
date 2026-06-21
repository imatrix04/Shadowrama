import type { BlockData, BlockProperty } from '../../types'
import { getBlockField, setBlockField } from '../../types'
import styles from './PropertiesPanel.module.css'

interface Props {
  block: BlockData | null
  onUpdateBlock: (id: number, changes: Partial<BlockData>) => void
}

export default function PropertiesPanel({ block, onUpdateBlock }: Props) {
  if (!block) return (
    <div className={styles.panel}>
      <p className={styles.empty}>Sélectionne un bloc</p>
    </div>
  )

  const renderField = (prop: BlockProperty) => {
    switch (prop.type) {
      case 'textarea':
        return (
          <textarea
            key={prop.key}
            className={styles.textarea}
            value={String(getBlockField(block, prop.key) ?? '')}
            onChange={e => onUpdateBlock(block.id, setBlockField(block, prop.key, e.target.value))}
          />
        )
      case 'number':
        return (
          <input
            key={prop.key}
            className={styles.input}
            type="number"
            value={Number(getBlockField(block, prop.key) ?? 0)}
            onChange={e => onUpdateBlock(block.id, setBlockField(block, prop.key, Number(e.target.value)))}
          />
        )
      case 'color':
        return (
          <input
            key={prop.key}
            className={styles.inputColor}
            type="color"
            value={String(getBlockField(block, prop.key) ?? '#ffffff')}
            onChange={e => onUpdateBlock(block.id, setBlockField(block, prop.key, e.target.value))}
          />
        )
      case 'text':
        return (
          <input
            key={prop.key}
            className={styles.input}
            type="text"
            value={String(getBlockField(block, prop.key) ?? '')}
            onChange={e => onUpdateBlock(block.id, setBlockField(block, prop.key, e.target.value))}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>Propriétés</h3>
      <p className={styles.type}>{block.type}</p>
      {block.properties?.map(prop => (
        <div key={prop.key} className={styles.field}>
          <label className={styles.label}>{prop.label}</label>
          {renderField(prop)}
        </div>
      ))}
      <div className={styles.position}>
        <span>X: {Math.round(block.x)}px</span>
        <span>Y: {Math.round(block.y)}px</span>
      </div>
    </div>
  )
}