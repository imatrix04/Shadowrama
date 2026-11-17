import { useEffect, useId, useRef, useState } from 'react'
import Icon from './Icon'
import type { IconName } from './Icon'
import styles from './DropdownMenu.module.css'

export interface MenuItem {
  label: string
  icon?: IconName
  /** Raccourci affiché à droite (information seulement). */
  shortcut?: string
  onSelect: () => void
  /** Filet de séparation au-dessus de cet élément. */
  separatorBefore?: boolean
}

interface Props {
  label: string
  items: MenuItem[]
}

/**
 * Menu déroulant : un bouton qui ouvre une liste d'actions.
 * Fermeture par Échap, clic à l'extérieur ou choix d'un élément ; flèches haut/bas
 * pour se déplacer (le focus revient sur le bouton à la fermeture au clavier).
 */
export default function DropdownMenu({ label, items }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const focusItem = (index: number) => {
    const all = rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]')
    if (!all || all.length === 0) return
    all[(index + all.length) % all.length].focus()
  }

  const currentIndex = () => {
    const all = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    return all.indexOf(document.activeElement as HTMLElement)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        // Les éléments n'existent qu'après le rendu.
        requestAnimationFrame(() => focusItem(0))
      } else {
        focusItem(currentIndex() + 1)
      }
    } else if (e.key === 'ArrowUp' && open) {
      e.preventDefault()
      focusItem(currentIndex() - 1)
    }
  }

  return (
    <div className={styles.root} ref={rootRef} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(o => !o)}
      >
        {label}
        <span className={styles.caret} aria-hidden="true" />
      </button>

      {open && (
        <div id={menuId} role="menu" className={styles.menu} aria-label={label}>
          {items.map(item => (
            <div key={item.label}>
              {item.separatorBefore && <div className={styles.separator} role="separator" />}
              <button
                type="button"
                role="menuitem"
                className={styles.item}
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
              >
                <span className={styles.itemIcon}>{item.icon && <Icon name={item.icon} size={16} />}</span>
                <span className={styles.itemLabel}>{item.label}</span>
                {item.shortcut && <kbd className={styles.shortcut}>{item.shortcut}</kbd>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
