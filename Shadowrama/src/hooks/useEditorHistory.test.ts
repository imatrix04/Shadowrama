import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useEditorHistory } from './useEditorHistory'
import type { Slide } from '../types'

const MAX_HISTORY = 50

function slide(id: number): Slide {
  return { id, blocks: [] }
}

function setup(initial: Slide[] = [slide(1)]) {
  return renderHook(() => useEditorHistory(initial))
}

describe('useEditorHistory', () => {
  it('démarre sans historique', () => {
    const { result } = setup()

    expect(result.current.slides).toEqual([slide(1)])
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('commit crée une entrée annulable', () => {
    const { result } = setup()

    act(() => result.current.commit(prev => [...prev, slide(2)]))
    expect(result.current.slides).toHaveLength(2)
    expect(result.current.canUndo).toBe(true)

    act(() => result.current.undo())
    expect(result.current.slides).toEqual([slide(1)])
  })

  // Modèle de geste : un déplacement produit des dizaines de `patch`, mais ne
  // doit laisser qu'une seule entrée d'historique — celle ouverte par `begin`.
  it('patch nécrit pas dans lhistorique', () => {
    const { result } = setup()

    act(() => result.current.patch(prev => [...prev, slide(2)]))

    expect(result.current.slides).toHaveLength(2)
    expect(result.current.canUndo).toBe(false)
  })

  it('un geste entier ne coûte quun seul annuler', () => {
    const { result } = setup()

    act(() => result.current.begin())
    act(() => result.current.patch(prev => [...prev, slide(2)]))
    act(() => result.current.patch(prev => [...prev, slide(3)]))

    act(() => result.current.undo())
    expect(result.current.slides).toEqual([slide(1)])
    expect(result.current.canUndo).toBe(false)
  })

  // Cliquer dans un champ sans rien modifier ne doit pas produire un « annuler »
  // qui ne change rien.
  it('begin répété sans modification nempile quun snapshot', () => {
    const { result } = setup()

    act(() => result.current.begin())
    act(() => result.current.begin())
    act(() => result.current.begin())

    act(() => result.current.undo())
    expect(result.current.canUndo).toBe(false)
  })

  it('refaire rétablit ce qui vient dêtre annulé', () => {
    const { result } = setup()

    act(() => result.current.commit(prev => [...prev, slide(2)]))
    act(() => result.current.undo())
    expect(result.current.canRedo).toBe(true)

    act(() => result.current.redo())
    expect(result.current.slides).toHaveLength(2)
    expect(result.current.canRedo).toBe(false)
  })

  it('une nouvelle modification efface le futur', () => {
    const { result } = setup()

    act(() => result.current.commit(prev => [...prev, slide(2)]))
    act(() => result.current.undo())
    act(() => result.current.commit(prev => [...prev, slide(3)]))

    expect(result.current.canRedo).toBe(false)
    expect(result.current.slides.map(s => s.id)).toEqual([1, 3])
  })

  it('annuler sans passé ne fait rien', () => {
    const { result } = setup()

    act(() => result.current.undo())
    expect(result.current.slides).toEqual([slide(1)])
  })

  it('refaire sans futur ne fait rien', () => {
    const { result } = setup()

    act(() => result.current.redo())
    expect(result.current.slides).toEqual([slide(1)])
  })

  it('reset vide lhistorique dans les deux sens', () => {
    const { result } = setup()

    act(() => result.current.commit(prev => [...prev, slide(2)]))
    act(() => result.current.undo())
    act(() => result.current.reset([slide(9)]))

    expect(result.current.slides).toEqual([slide(9)])
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  // La pile est bornée : sans ça, une longue session d'édition retient tous les
  // états intermédiaires du projet.
  it('plafonne le passé et oublie les plus anciens états', () => {
    const { result } = setup()

    for (let i = 0; i < MAX_HISTORY + 10; i++) {
      act(() => result.current.commit(prev => [...prev, slide(100 + i)]))
    }

    for (let i = 0; i < MAX_HISTORY; i++) {
      act(() => result.current.undo())
    }

    expect(result.current.canUndo).toBe(false)
    // Les dix premières modifications sont sorties de la pile : on ne revient
    // pas jusqu'à l'état initial.
    expect(result.current.slides.length).toBeGreaterThan(1)
  })

  // `isDirty` dans la barre du haut compare des références : un aller-retour
  // annuler/refaire doit rendre la MÊME référence, sinon un projet enregistré
  // repasse en « modifié » sans raison.
  it('annuler restaure la référence exacte de létat précédent', () => {
    const { result } = setup()
    const initial = result.current.slides

    act(() => result.current.commit(prev => [...prev, slide(2)]))
    act(() => result.current.undo())

    expect(result.current.slides).toBe(initial)
  })
})
