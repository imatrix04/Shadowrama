import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import styles from './CustomSelect.module.css'

interface Option {
  label: string
  value: string
}

interface Props {
  value: string
  options: Option[]
  onChange: (value: string) => void
}

export default function CustomSelect({ value, options, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)

  const openDropdown = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setCoords({ x: rect.left, y: rect.bottom + 6, width: rect.width })
    setClosing(false)
    setOpen(true)
  }

  const closeDropdown = () => {
    setClosing(true)
    setTimeout(() => {
      setOpen(false)
      setClosing(false)
    }, 140)
  }

  const toggle = () => (open ? closeDropdown() : openDropdown())

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        listRef.current?.contains(e.target as Node)
      ) return
      closeDropdown()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDropdown()
    }
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const handleSelect = (v: string) => {
    onChange(v)
    closeDropdown()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerActive : ''}`}
        onClick={toggle}
      >
        <span className={styles.triggerLabel}>{selected?.label ?? '—'}</span>
        <svg
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
          width="10" height="6" viewBox="0 0 10 6" fill="none"
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={listRef}
          className={`${styles.list} ${closing ? styles.listClosing : ''}`}
          style={{ left: coords.x, top: coords.y, width: coords.width }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.option} ${opt.value === value ? styles.optionActive : ''}`}
              onClick={() => handleSelect(opt.value)}
            >
              {opt.label}
              {opt.value === value && (
                <svg className={styles.check} width="12" height="10" viewBox="0 0 12 10" fill="none">
                  <path d="M1 5l3.5 3.5L11 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}