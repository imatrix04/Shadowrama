import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import styles from './Dialog.module.css'

export interface DialogAction {
  label: string
  onClick: () => void
  variant?: 'accent' | 'danger'
}

interface Props {
  title: string
  /** Corps du message. Absent pour un dialogue de saisie seule. */
  message?: string
  /** Valeur du champ texte ; le champ n'apparaît que si défini. */
  inputValue?: string
  onInputChange?: (value: string) => void
  actions: DialogAction[]
  /** Échap, clic sur le fond, ou bouton d'annulation. */
  onDismiss: () => void
  /** Exécutée sur Entrée depuis le champ texte. */
  onSubmit?: () => void
}

/**
 * Remplace `alert()` / `confirm()`, qui bloquent le processus de rendu, sortent
 * de la charte graphique et ne sont pas stylables.
 */
export default function Dialog({
  title, message, inputValue, onInputChange, actions, onDismiss, onSubmit,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Le focus part dans le dialogue : Échap fonctionne sans clic préalable, et
    // les raccourcis de l'éditeur (Suppr, flèches) ne s'appliquent plus derrière.
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    } else {
      dialogRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onDismiss()
      }
    }
    // En capture : on intercepte avant les raccourcis globaux de l'éditeur.
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [onDismiss])

  return createPortal(
    <div className={styles.overlay} onMouseDown={onDismiss}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={styles.dialog}
        onMouseDown={e => e.stopPropagation()}
      >
        <p className={styles.title}>{title}</p>
        {message && <p className={styles.body}>{message}</p>}

        {inputValue !== undefined && (
          <input
            ref={inputRef}
            className={styles.input}
            value={inputValue}
            onChange={e => onInputChange?.(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onSubmit?.()
            }}
          />
        )}

        <div className={styles.actions}>
          {actions.map(action => (
            <button
              key={action.label}
              className={`${styles.btn} ${
                action.variant === 'accent' ? styles.btnAccent
                : action.variant === 'danger' ? styles.btnDanger
                : ''
              }`}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
