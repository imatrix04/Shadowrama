// hooks/useEditorHistory.ts
import { useState, useCallback, useRef } from 'react'
import type { Slide } from '../types'

const MAX_HISTORY = 50

export function useEditorHistory(initial: Slide[]) {
  const [slides, setSlidesState] = useState<Slide[]>(initial)
  const past = useRef<Slide[][]>([])
  const future = useRef<Slide[][]>([])

  const commit = useCallback((updater: (prev: Slide[]) => Slide[]) => {
    setSlidesState(prev => {
      past.current.push(prev)
      if (past.current.length > MAX_HISTORY) past.current.shift()
      future.current = []
      return updater(prev)
    })
  }, [])

  const patch = useCallback((updater: (prev: Slide[]) => Slide[]) => {
    setSlidesState(updater)
  }, [])

  const undo = useCallback(() => {
    setSlidesState(prev => {
      const last = past.current.pop()
      if (!last) return prev
      future.current.push(prev)
      return last
    })
  }, [])

  const redo = useCallback(() => {
    setSlidesState(prev => {
      const next = future.current.pop()
      if (!next) return prev
      past.current.push(prev)
      return next
    })
  }, [])

  // Reset complet : nouvel état + vidage de l'historique (nouveau projet / ouverture fichier)
  const reset = useCallback((newSlides: Slide[]) => {
    past.current = []
    future.current = []
    setSlidesState(newSlides)
  }, [])

  const canUndo = () => past.current.length > 0
  const canRedo = () => future.current.length > 0

  return { slides, commit, patch, undo, redo, canUndo, canRedo, setSlides: setSlidesState, reset }
}