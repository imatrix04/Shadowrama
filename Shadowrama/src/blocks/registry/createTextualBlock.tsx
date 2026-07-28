import { useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import type { BlockComponentProps, TextBlockData, TitleBlockData } from '../../types'

type TextualBlockData = TextBlockData | TitleBlockData

/**
 * Bloc de texte éditable en place. `TextBlock` et `TitleBlock` ne diffèrent que
 * par leur style par défaut, d'où cette fabrique plutôt que deux copies.
 */
export function createTextualBlock(defaultFontSize: number, extraStyle: CSSProperties) {
  return function TextualBlock({
    block,
    onUpdate,
    isEditing,
    onStartEdit,
    onStopEdit,
  }: BlockComponentProps<TextualBlockData>) {
    const ref = useRef<HTMLDivElement>(null)
    // Contenu à restaurer sur Échap : capturé à l'ENTRÉE en édition.
    // Un simple useState initialisé au montage restait bloqué sur le tout
    // premier contenu et Échap réécrivait un texte périmé.
    const contentBeforeEdit = useRef(block.content)

    useEffect(() => {
      if (isEditing) {
        contentBeforeEdit.current = block.content
      } else if (ref.current) {
        ref.current.innerText = block.content
      }
      // Pendant l'édition le DOM est la source de vérité : le réécrire à chaque
      // frappe ferait sauter le curseur en fin de texte.
    }, [block.content, isEditing])

    const handleDoubleClick = () => {
      onStartEdit?.()
      // Le champ ne devient contentEditable qu'au rendu suivant : on place le
      // curseur une fois ce rendu appliqué.
      setTimeout(() => {
        if (!ref.current) return
        ref.current.focus()
        const range = document.createRange()
        range.selectNodeContents(ref.current)
        range.collapse(false)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }, 0)
    }

    const handleInput = () => {
      onUpdate?.(block.id, { content: ref.current?.innerText ?? '' })
    }

    const handleBlur = () => {
      const el = ref.current
      const content = el?.innerText ?? ''

      // Le bloc a une hauteur fixe : un texte plus long débordait silencieusement
      // sous le cadre. On agrandit le bloc à la fin de la saisie (pas pendant,
      // pour éviter qu'il ne sautille à chaque caractère).
      const overflow = el && el.scrollHeight > el.clientHeight
      onUpdate?.(block.id, overflow ? { content, height: el.scrollHeight } : { content })
      onStopEdit?.()
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (ref.current) ref.current.innerText = contentBeforeEdit.current
        onUpdate?.(block.id, { content: contentBeforeEdit.current })
        ref.current?.blur()
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        ref.current?.blur()
      }
    }

    return (
      <div
        ref={ref}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onDoubleClick={handleDoubleClick}
        onInput={handleInput}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={{
          margin: 0,
          fontSize: block.fontSize ?? defaultFontSize,
          color: block.color,
          textAlign: block.textAlign || 'center',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          outline: isEditing ? '2px solid #6c63ff' : 'none',
          borderRadius: '3px',
          padding: '4px 6px',
          minWidth: '40px',
          minHeight: '1em',
          cursor: isEditing ? 'text' : 'inherit',
          width: '100%',
          height: '100%',
          ...extraStyle,
        }}
      />
    )
  }
}
