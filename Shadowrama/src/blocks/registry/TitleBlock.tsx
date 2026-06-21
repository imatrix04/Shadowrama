import { useRef, useState, useEffect } from 'react'
import type { BlockComponentProps, TitleBlockData } from '../../types'

export default function TitleBlock({ block, onUpdate, isEditing, onStartEdit, onStopEdit }: BlockComponentProps<TitleBlockData>) {
  const ref = useRef<HTMLDivElement>(null)
  const [savedContent, setSavedContent] = useState(block.content)

  useEffect(() => {
    if (!isEditing && ref.current) {
      ref.current.innerText = block.content
    }
  }, [block.content, isEditing])

  const handleDoubleClick = () => {
    onStartEdit?.()
    setTimeout(() => {
      if (!ref.current) return
      ref.current.focus()
      const range = document.createRange()
      range.selectNodeContents(ref.current)
      range.collapse(false)
      window.getSelection()?.removeAllRanges()
      window.getSelection()?.addRange(range)
    }, 0)
  }

  const handleBlur = () => {
    const newContent = ref.current?.innerText ?? ''
    setSavedContent(newContent)
    onUpdate?.(block.id, { content: newContent })
    onStopEdit?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (ref.current) ref.current.innerText = savedContent
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
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      style={{
        margin: 0,
        fontSize: block.fontSize ?? 40,
        color: block.color,
        textAlign: block.textAlign || 'left',
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
        fontWeight: 'bold',
      }}
    />
  )
}