import { describe, expect, it } from 'vitest'
import { alignBlocks, boundsOf, distributeBlocks } from './alignment'
import type { Box } from './alignment'

const box = (id: number, x: number, y: number, width = 100, height = 40): Box => ({ id, x, y, width, height })

/** Applique un lot de mises à jour à des boîtes, pour vérifier le résultat final. */
function apply(boxes: Box[], updates: { id: number; changes: Partial<Box> }[]): Box[] {
  return boxes.map(b => ({ ...b, ...(updates.find(u => u.id === b.id)?.changes ?? {}) }))
}

describe('boundsOf', () => {
  it("renvoie l'enveloppe de plusieurs boîtes", () => {
    expect(boundsOf([box(1, 10, 20), box(2, 200, 100, 50, 80)])).toEqual({ x: 10, y: 20, width: 240, height: 160 })
  })
})

describe('alignBlocks', () => {
  const blocks = [box(1, 100, 50), box(2, 300, 200, 60, 80), box(3, 500, 120, 200, 20)]

  it("aligne à gauche sur le bord de l'enveloppe", () => {
    const result = apply(blocks, alignBlocks(blocks, 'left', 'selection') as never)
    expect(result.map(b => b.x)).toEqual([100, 100, 100])
  })

  it("aligne à droite sur le bord de l'enveloppe, quelle que soit la largeur", () => {
    const result = apply(blocks, alignBlocks(blocks, 'right', 'selection') as never)
    // Enveloppe : 100 → 700.
    expect(result.map(b => b.x + b.width)).toEqual([700, 700, 700])
  })

  it('centre horizontalement chaque bloc sur le centre de la sélection', () => {
    const result = apply(blocks, alignBlocks(blocks, 'centerX', 'selection') as never)
    // Centre de l'enveloppe : 400.
    expect(result.map(b => b.x + b.width / 2)).toEqual([400, 400, 400])
  })

  it('aligne en haut, au milieu et en bas', () => {
    const top = apply(blocks, alignBlocks(blocks, 'top', 'selection') as never)
    expect(top.map(b => b.y)).toEqual([50, 50, 50])
    const bottom = apply(blocks, alignBlocks(blocks, 'bottom', 'selection') as never)
    expect(bottom.map(b => b.y + b.height)).toEqual([280, 280, 280])
    const middle = apply(blocks, alignBlocks(blocks, 'centerY', 'selection') as never)
    expect(middle.map(b => b.y + b.height / 2)).toEqual([165, 165, 165])
  })

  it('un bloc seul est aligné sur la diapositive', () => {
    const [b] = apply([box(1, 10, 10, 200, 100)], alignBlocks([box(1, 10, 10, 200, 100)], 'centerX', 'selection') as never)
    expect(b.x).toBe(380)
    const [c] = apply([box(1, 10, 10, 200, 100)], alignBlocks([box(1, 10, 10, 200, 100)], 'centerY', 'selection') as never)
    expect(c.y).toBe(220)
  })

  it('la référence « diapositive » prime sur la sélection', () => {
    const result = apply(blocks, alignBlocks(blocks, 'left', 'slide') as never)
    expect(result.map(b => b.x)).toEqual([0, 0, 0])
  })

  it("ne renvoie que les blocs qui bougent", () => {
    const updates = alignBlocks(blocks, 'left', 'selection')
    // Le bloc 1 est déjà au bord gauche de l'enveloppe.
    expect(updates.map(u => u.id)).toEqual([2, 3])
  })

  it('renvoie un lot vide quand tout est déjà aligné', () => {
    expect(alignBlocks([box(1, 0, 0), box(2, 0, 100)], 'left', 'selection')).toEqual([])
  })
})

describe('distributeBlocks', () => {
  it('répartit horizontalement à espaces égaux, extrêmes immobiles', () => {
    const blocks = [box(1, 0, 0), box(2, 120, 0), box(3, 500, 0)]
    const result = apply(blocks, distributeBlocks(blocks, 'x') as never)
    // Étendue 0 → 600, largeur cumulée 300 : deux espaces de 150.
    expect(result.map(b => b.x)).toEqual([0, 250, 500])
  })

  it("trie par position : l'ordre du tableau n'a pas d'importance", () => {
    const blocks = [box(3, 500, 0), box(1, 0, 0), box(2, 120, 0)]
    const result = apply(blocks, distributeBlocks(blocks, 'x') as never)
    expect(result.find(b => b.id === 2)?.x).toBe(250)
  })

  it('répartit verticalement', () => {
    const blocks = [box(1, 0, 0, 50, 40), box(2, 0, 30, 50, 40), box(3, 0, 260, 50, 40)]
    const result = apply(blocks, distributeBlocks(blocks, 'y') as never)
    // Étendue 0 → 300, hauteur cumulée 120 : deux espaces de 90.
    expect(result.map(b => b.y)).toEqual([0, 130, 260])
  })

  it('exige au moins trois blocs', () => {
    expect(distributeBlocks([box(1, 0, 0), box(2, 300, 0)], 'x')).toEqual([])
  })
})
