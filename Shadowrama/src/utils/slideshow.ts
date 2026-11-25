import { useCallback, useState } from 'react'
import type { Slide } from '../types'

export type SlideshowMode = 'manual' | 'auto'

/** Durée d'affichage d'une diapositive sans réglage, en secondes. */
export const DEFAULT_SLIDE_DURATION = 10
export const MIN_SLIDE_DURATION = 1
export const MAX_SLIDE_DURATION = 3600

const STORAGE_KEY = 'shadowrama.slideshowMode'

export function slideDuration(slide: Slide): number {
  const d = slide.duration
  if (typeof d !== 'number' || !Number.isFinite(d)) return DEFAULT_SLIDE_DURATION
  return Math.min(MAX_SLIDE_DURATION, Math.max(MIN_SLIDE_DURATION, d))
}

function readMode(): SlideshowMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'auto' ? 'auto' : 'manual'
  } catch {
    return 'manual'
  }
}

/** Type de diaporama, mémorisé d'une session à l'autre. */
export function useSlideshowMode() {
  const [mode, setModeState] = useState<SlideshowMode>(readMode)
  const setMode = useCallback((next: SlideshowMode) => {
    setModeState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* stockage indisponible */ }
  }, [])
  return { mode, setMode }
}
