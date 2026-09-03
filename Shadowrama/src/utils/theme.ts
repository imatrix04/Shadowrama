export type ThemeMode = 'dark' | 'light' | 'system'
export type ResolvedTheme = 'dark' | 'light'
 
const STORAGE_KEY = 'shadowrama-theme'
 
export function loadThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
  } catch {
    // Stockage indisponible (navigation privée, quota) : on retombe sur la
    // préférence système plutôt que de faire échouer le démarrage.
  }
  return 'system'
}
 
export function saveThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Idem : le choix ne survivra juste pas au redémarrage.
  }
}
 
export function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}
 
/** Convertit le mode choisi par l'utilisateur en thème effectivement appliqué. */
export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode
}
 
/**
 * Pose l'attribut `data-theme` sur `<html>`, lu par les sélecteurs
 * `[data-theme="light"]` de theme.css. Appelée à la fois de façon synchrone
 * au tout début de main.tsx (pour éviter un flash de thème sombre avant que
 * React ne monte) et depuis useTheme à chaque changement.
 */
export function applyTheme(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved
}
 
function distanceToFarthestCorner(x: number, y: number): number {
  return Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  )
}
 
/**
 * Change de thème avec une transition en cercle qui part du point cliqué
 * (View Transitions API — native dans le Chromium embarqué par Electron 42,
 * pas besoin de polyfill). Sans origine — la préférence système change
 * pendant que l'app tourne, sans clic de l'utilisateur — le cercle part du
 * centre de l'écran.
 *
 * Retombe sur un changement instantané si l'API n'existe pas ou que
 * l'utilisateur préfère moins de mouvement : jamais de version dégradée à
 * moitié animée.
 */
export function applyThemeWithTransition(resolved: ResolvedTheme, origin?: { x: number; y: number }): void {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion || typeof document.startViewTransition !== 'function') {
    applyTheme(resolved)
    return
  }
 
  const x = origin?.x ?? window.innerWidth / 2
  const y = origin?.y ?? window.innerHeight / 2
  const root = document.documentElement
  root.style.setProperty('--theme-reveal-x', `${x}px`)
  root.style.setProperty('--theme-reveal-y', `${y}px`)
  root.style.setProperty('--theme-reveal-radius', `${Math.ceil(distanceToFarthestCorner(x, y))}px`)
 
  document.startViewTransition(() => {
    applyTheme(resolved)
  })
}