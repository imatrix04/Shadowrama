// hooks/useEditorHistory.ts
import { useState, useCallback, useMemo } from 'react'
import type { Slide } from '../types'

const MAX_HISTORY = 50

interface HistoryState {
  past: Slide[][]
  present: Slide[]
  future: Slide[][]
}

function pushPast(past: Slide[][], present: Slide[]): Slide[][] {
  const next = [...past, present]
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
}

/**
 * Historique d'édition.
 *
 * Modèle de « geste » : un déplacement, un redimensionnement ou une saisie de
 * texte produit des dizaines de mises à jour, mais ne doit laisser qu'une seule
 * entrée d'historique. On prend donc le snapshot AU DÉBUT du geste (`begin`, sur
 * le mousedown), puis on applique les états intermédiaires via `patch`, qui
 * n'écrit pas dans l'historique.
 *
 * `commit` est le raccourci pour une modification atomique (ajout, suppression,
 * réordonnancement) : snapshot + application en une seule fois.
 */
export function useEditorHistory(initial: Slide[]) {
  const [state, setState] = useState<HistoryState>({
    past: [],
    present: initial,
    future: [],
  })

  // Ouvre un geste : mémorise l'état courant comme point de retour.
  // Les états étant immuables, comparer les références suffit à ne pas empiler
  // deux fois le même snapshot (ex: focus d'un champ sans modification).
  const begin = useCallback(() => {
    setState(s => (
      s.past[s.past.length - 1] === s.present
        ? s
        : { past: pushPast(s.past, s.present), present: s.present, future: [] }
    ))
  }, [])

  const commit = useCallback((updater: (prev: Slide[]) => Slide[]) => {
    setState(s => ({
      past: pushPast(s.past, s.present),
      present: updater(s.present),
      future: [],
    }))
  }, [])

  // État intermédiaire d'un geste déjà ouvert par `begin` : pas d'historique.
  const patch = useCallback((updater: (prev: Slide[]) => Slide[]) => {
    setState(s => ({ ...s, present: updater(s.present) }))
  }, [])

  const undo = useCallback(() => {
    setState(s => {
      if (s.past.length === 0) return s
      return {
        past: s.past.slice(0, -1),
        present: s.past[s.past.length - 1],
        future: [...s.future, s.present],
      }
    })
  }, [])

  const redo = useCallback(() => {
    setState(s => {
      if (s.future.length === 0) return s
      return {
        past: pushPast(s.past, s.present),
        present: s.future[s.future.length - 1],
        future: s.future.slice(0, -1),
      }
    })
  }, [])

  // Reset complet : nouvel état + vidage de l'historique (nouveau projet / ouverture fichier)
  const reset = useCallback((newSlides: Slide[]) => {
    setState({ past: [], present: newSlides, future: [] })
  }, [])

  return useMemo(() => ({
    slides: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    begin,
    commit,
    patch,
    undo,
    redo,
    reset,
  }), [state, begin, commit, patch, undo, redo, reset])
}
