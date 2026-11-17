import { useSyncExternalStore } from 'react'
import { addFavorite, addRecent, parseSwatches, removeColor } from './colorPalette'
import type { Swatches } from './colorPalette'

/**
 * Palette partagée par tous les sélecteurs de couleur de l'appli, et mémorisée.
 *
 * Un store minimal plutôt qu'un état par sélecteur : plusieurs champs de
 * couleur sont affichés en même temps (panneau Arrière-plan), et une couleur
 * choisie dans l'un doit apparaître tout de suite dans la palette des autres.
 */

const KEY = 'shadowrama-color-swatches'

function load(): Swatches {
  try {
    return parseSwatches(localStorage.getItem(KEY))
  } catch {
    return parseSwatches(null)
  }
}

let state: Swatches = load()
const listeners = new Set<() => void>()

function commit(next: Swatches) {
  if (next === state) return
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Sans persistance, la palette ne survit juste pas au redémarrage.
  }
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

const getSnapshot = () => state

/** Une couleur vient d'être choisie : elle rejoint les récentes. */
export function rememberColor(color: string) {
  const recent = addRecent(state.recent, color)
  if (recent !== state.recent) commit({ ...state, recent })
}

export function pinColor(color: string) {
  const favorites = addFavorite(state.favorites, color)
  if (favorites !== state.favorites) commit({ ...state, favorites })
}

export function unpinColor(color: string) {
  const favorites = removeColor(state.favorites, color)
  if (favorites !== state.favorites) commit({ ...state, favorites })
}

export function useColorSwatches(): Swatches {
  return useSyncExternalStore(subscribe, getSnapshot)
}
