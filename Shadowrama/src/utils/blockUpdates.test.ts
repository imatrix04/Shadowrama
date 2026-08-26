import { describe, expect, it } from 'vitest'
import { applyBlockUpdates } from './blockUpdates'
import type { Slide, TextBlockData } from '../types'

function text(id: number, x = 0, y = 0): TextBlockData {
  return { type: 'text', id, x, y, width: 100, height: 40, content: `bloc ${id}` }
}

function slides(): Slide[] {
  return [
    { id: 1, blocks: [text(10), text(11)] },
    { id: 2, blocks: [text(20)] },
  ]
}

describe('applyBlockUpdates', () => {
  it("n'applique les changements qu'à la diapositive visée", () => {
    const before = slides()
    const after = applyBlockUpdates(before, 0, [{ id: 10, changes: { x: 50 } }])

    expect(after[0].blocks[0].x).toBe(50)
    expect(after[1].blocks[0].x).toBe(0)
  })

  it('applique tout un lot en une passe', () => {
    const after = applyBlockUpdates(slides(), 0, [
      { id: 10, changes: { x: 5, y: 6 } },
      { id: 11, changes: { x: 7 } },
    ])

    expect(after[0].blocks[0]).toMatchObject({ x: 5, y: 6 })
    expect(after[0].blocks[1]).toMatchObject({ x: 7, y: 0 })
  })

  // L'historique et `isDirty` comparent des références : réécrire une diapositive
  // intacte la ferait passer pour modifiée et remplirait l'historique de faux pas.
  it('préserve la référence des diapositives non touchées', () => {
    const before = slides()
    const after = applyBlockUpdates(before, 0, [{ id: 10, changes: { x: 50 } }])

    expect(after[1]).toBe(before[1])
    expect(after[0]).not.toBe(before[0])
  })

  it('préserve la référence des blocs non visés', () => {
    const before = slides()
    const after = applyBlockUpdates(before, 0, [{ id: 10, changes: { x: 50 } }])

    expect(after[0].blocks[1]).toBe(before[0].blocks[1])
  })

  it('ignore un identifiant absent de la diapositive', () => {
    const before = slides()
    const after = applyBlockUpdates(before, 0, [{ id: 999, changes: { x: 50 } }])

    expect(after[0].blocks).toEqual(before[0].blocks)
  })

  it('rend le tableau initial quand le lot est vide', () => {
    const before = slides()
    expect(applyBlockUpdates(before, 0, [])).toBe(before)
  })

  it('ne mute pas les données en entrée', () => {
    const before = slides()
    applyBlockUpdates(before, 0, [{ id: 10, changes: { x: 50 } }])

    expect(before[0].blocks[0].x).toBe(0)
  })

  it('accepte un index hors bornes sans rien changer', () => {
    const before = slides()
    expect(applyBlockUpdates(before, 9, [{ id: 10, changes: { x: 50 } }])).toEqual(before)
  })
})
