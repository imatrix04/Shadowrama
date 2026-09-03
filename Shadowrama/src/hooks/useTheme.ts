// hooks/useTheme.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type ThemeMode, type ResolvedTheme,
  loadThemeMode, saveThemeMode, systemPrefersDark, applyTheme, applyThemeWithTransition,
} from '../utils/theme'

/**
 * Thème de l'interface de création. `mode` est le choix de l'utilisateur
 * (peut être 'system'), `resolvedTheme` est le thème effectivement appliqué
 * ('dark' ou 'light') — c'est ce second qu'on affiche coché en mode Système
 * dans le sélecteur, pour que l'utilisateur voie ce qui est réellement actif.
 */
export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(loadThemeMode)
  // Seule la préférence système est un état externe qui change de façon
  // asynchrone (l'utilisateur bascule son thème OS pendant que l'app tourne) :
  // c'est la seule valeur qui a besoin d'un state ici. Le thème résolu pour
  // 'dark'/'light' est une dérivation pure de `mode`, calculée au rendu plus
  // bas — pas besoin d'un setState en cascade dans un effet pour ça.
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark)
  // Point de clic à animer pour la transition circulaire (voir setMode) :
  // une ref, pas un state, parce que ça ne doit jamais déclencher de rendu.
  const clickOriginRef = useRef<{ x: number; y: number } | undefined>(undefined)
  // Le tout premier passage de l'effet ci-dessous correspond au montage, pas
  // à un choix de l'utilisateur : le thème est déjà posé de façon synchrone
  // par main.tsx avant que React ne monte, donc pas de cercle à jouer ici.
  const isFirstApply = useRef(true)

  // Persiste le choix. Effet de synchronisation avec un système externe
  // (localStorage), pas de dérivation d'état interne — pas de setState ici.
  useEffect(() => {
    saveThemeMode(mode)
  }, [mode])

  // En mode 'system', on suit les changements de préférence OS en direct :
  // sans ça, quelqu'un qui bascule son thème système pendant que l'app est
  // ouverte devrait la relancer pour que ça se répercute.
  useEffect(() => {
    if (mode !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemDark(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [mode])

  const resolvedTheme: ResolvedTheme = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode

  // Répercute le thème résolu sur le DOM (`data-theme`) : c'est bien une
  // synchronisation vers un système externe, le cas légitime pour un effet.
  useEffect(() => {
    const origin = clickOriginRef.current
    clickOriginRef.current = undefined
    if (isFirstApply.current) {
      isFirstApply.current = false
      applyTheme(resolvedTheme)
      return
    }
    applyThemeWithTransition(resolvedTheme, origin)
  }, [resolvedTheme])

  return {
    mode,
    resolvedTheme,
    /**
     * `origin` est le point (coordonnées écran) d'où doit partir le cercle de
     * transition — typiquement `{ x: e.clientX, y: e.clientY }` du clic qui a
     * déclenché le changement. Omis : le cercle part du centre.
     */
    setMode: useCallback((next: ThemeMode, origin?: { x: number; y: number }) => {
      clickOriginRef.current = origin
      setModeState(next)
    }, []),
  }
}