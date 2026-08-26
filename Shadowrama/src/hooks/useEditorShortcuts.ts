import { useEffect, useRef } from 'react'

/**
 * Raccourcis clavier de l'éditeur, en un seul endroit.
 *
 * Ils étaient auparavant répartis entre Editor (annuler, tout sélectionner,
 * dupliquer, presse-papiers) et Canvas (suppression, flèches), avec deux
 * écouteurs `window` et deux versions légèrement différentes du test « l'utilisateur
 * est-il en train de saisir du texte ? ». Une seule liste évite qu'un raccourci
 * ajouté d'un côté entre en conflit avec l'autre.
 *
 * Ne couvre que l'édition des blocs. Restent chez eux, parce qu'ils n'ont de sens
 * que là où ils sont définis : Ctrl+S (barre du haut), Échap des boîtes de
 * dialogue, et les flèches du mode présentation.
 */

/** Pas d'un déplacement à la flèche, en pixels canvas. */
const NUDGE_STEP = 1
const NUDGE_STEP_FAST = 10

const ARROWS: Record<string, { dx: number; dy: number }> = {
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
}

/**
 * Vrai quand le focus est dans un champ ou dans un bloc en cours d'édition :
 * les raccourcis d'édition de texte du navigateur doivent alors l'emporter.
 * `isContentEditable` couvre aussi les descendants d'une zone éditable, là où
 * un test sur l'attribut seul les manquait.
 */
function isTypingTarget(): boolean {
  const el = document.activeElement
  return el instanceof HTMLElement && (
    el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
  )
}

export interface EditorShortcutActions {
  /** Sans sélection, suppression et flèches n'ont rien à faire — et surtout rien
   *  à inscrire dans l'historique. */
  hasSelection: boolean
  undo: () => void
  redo: () => void
  selectAll: () => void
  duplicate: () => void
  copy: () => void
  cut: () => void
  paste: () => void
  deleteSelection: () => void
  /** Décalage en pixels canvas. */
  nudge: (dx: number, dy: number) => void
  /** Ouvre l'entrée d'historique au début d'une rafale de flèches. */
  beginGesture: () => void
}

export function useEditorShortcuts(actions: EditorShortcutActions, enabled: boolean) {
  // Les actions changent à chaque rendu (elles dépendent de la sélection et de la
  // diapositive courante). On les lit dans une ref plutôt que de les passer en
  // dépendances : l'écouteur est posé une seule fois, tout en voyant toujours la
  // version à jour.
  const latest = useRef(actions)
  useEffect(() => {
    latest.current = actions
  })

  // Un appui prolongé sur une flèche émet des dizaines de keydown : une seule
  // entrée d'historique pour toute la rafale, refermée au keyup.
  const nudgeGestureOpen = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const a = latest.current
      const mod = e.ctrlKey || e.metaKey
      // Minuscule forcée : avec Maj enfoncée, `e.key` vaut « Z » et non « z »,
      // ce qui empêchait Ctrl+Maj+Z de refaire. Vaut aussi pour Verr. Maj.
      const key = e.key.toLowerCase()

      // Annuler / refaire restent actifs pendant une saisie : toute une session
      // d'édition de texte ne forme qu'une entrée d'historique, et c'est bien
      // celle-là qu'on veut annuler.
      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault()
        a.undo()
        return
      }
      if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault()
        a.redo()
        return
      }

      if (isTypingTarget()) return

      if (mod) {
        switch (key) {
          case 'a': e.preventDefault(); a.selectAll(); return
          case 'd': e.preventDefault(); a.duplicate(); return
          case 'c': e.preventDefault(); a.copy(); return
          case 'x': e.preventDefault(); a.cut(); return
          case 'v': e.preventDefault(); a.paste(); return
        }
      }

      if (!a.hasSelection) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        a.deleteSelection()
        return
      }

      const arrow = ARROWS[e.key]
      if (arrow) {
        e.preventDefault()
        if (!nudgeGestureOpen.current) {
          nudgeGestureOpen.current = true
          a.beginGesture()
        }
        const step = e.shiftKey ? NUDGE_STEP_FAST : NUDGE_STEP
        a.nudge(arrow.dx * step, arrow.dy * step)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (ARROWS[e.key]) nudgeGestureOpen.current = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [enabled])
}
