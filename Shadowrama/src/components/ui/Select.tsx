import { useEffect, useId, useRef, useState } from 'react'
import styles from './Select.module.css'

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  'aria-label'?: string
  /** Version réduite, pour une barre d'outils : largeur du contenu, menu aligné à droite. */
  compact?: boolean
  /** Ouvre le menu vers le haut (sélecteur placé en bas d'un panneau). */
  up?: boolean
  /** Libellé affiché avant la valeur, dans le bouton. */
  prefix?: string
}

/** Liste déroulante stylée (le menu natif ne peut pas suivre le thème). */
export default function Select({ value, options, onChange, compact, up, prefix, ...rest }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.findIndex(o => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const openList = () => {
    setActive(Math.max(selected, 0))
    setOpen(true)
  }

  const pick = (index: number) => {
    onChange(options[index].value)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return openList()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive(i => (i + step + options.length) % options.length)
    } else if ((e.key === 'Enter' || e.key === ' ') && open) {
      e.preventDefault()
      pick(active)
    }
  }

  return (
    <div className={`${styles.root} ${compact ? styles.compact : ''} ${up ? styles.up : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={rest['aria-label']}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        {prefix && <span className={styles.prefix}>{prefix}</span>}
        <span className={styles.value}>{options[selected]?.label ?? value}</span>
        <span className={styles.caret} aria-hidden="true" />
      </button>
      {open && (
        <ul className={styles.menu} id={listId} role="listbox">
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={i === selected}
              className={`${styles.option} ${i === active ? styles.optionActive : ''} ${i === selected ? styles.optionSelected : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(i)}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
