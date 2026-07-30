import { useRef, useEffect } from 'react'
import type { BlockComponentProps, TextBlockData, TitleBlockData } from '../../types'

type TextualBlockData = TextBlockData | TitleBlockData

const VERTICAL_ALIGN = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
} as const

/**
 * Bloc de texte éditable en place. `TextBlock` et `TitleBlock` ne diffèrent que
 * par leurs valeurs par défaut (voir les fichiers de config), d'où cette
 * fabrique plutôt que deux copies.
 */
export function createTextualBlock(defaultFontSize: number) {
  return function TextualBlock({
    block,
    onUpdate,
    isEditing,
    onStartEdit,
    onStopEdit,
  }: BlockComponentProps<TextualBlockData>) {
    // Deux éléments sont nécessaires : le conteneur porte l'alignement vertical,
    // l'élément éditable garde une hauteur automatique — sinon il occuperait
    // toute la boîte et le centrage n'aurait aucun effet.
    const boxRef = useRef<HTMLDivElement>(null)
    const ref = useRef<HTMLDivElement>(null)

    // Contenu à restaurer sur Échap : capturé à l'ENTRÉE en édition.
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
      const content = ref.current?.innerText ?? ''

      // Le bloc a une hauteur fixe : un texte plus long débordait silencieusement
      // sous le cadre. On compare la hauteur du texte à celle de la boîte (et non
      // scrollHeight/clientHeight du même élément, qui sont désormais égaux
      // puisque l'élément éditable est en hauteur automatique).
      const needed = ref.current?.scrollHeight ?? 0
      const available = boxRef.current?.clientHeight ?? 0
      const overflows = needed > available

      onUpdate?.(block.id, overflows ? { content, height: needed } : { content })
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
        ref={boxRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: VERTICAL_ALIGN[block.verticalAlign ?? 'top'],
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
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
            width: '100%',
            fontSize: block.fontSize ?? defaultFontSize,
            fontWeight: block.fontWeight ?? 'normal',
            fontStyle: block.fontStyle ?? 'normal',
            lineHeight: block.lineHeight ?? 1.4,
            letterSpacing: block.letterSpacing ? `${block.letterSpacing}px` : 'normal',
            color: block.color,
            textAlign: block.textAlign || 'center',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            outline: isEditing ? '2px solid var(--accent)' : 'none',
            borderRadius: 'var(--r-sm)',
            padding: '4px 6px',
            minHeight: '1em',
            cursor: isEditing ? 'text' : 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>
    )
  }
}
