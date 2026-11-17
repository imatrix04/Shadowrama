import { describe, expect, it } from 'vitest'
import { nearestTarget, snapAxis } from './snapping'

describe('snapAxis', () => {
  it("choisit la correction la plus petite, pas la première cible rencontrée", () => {
    // Le bord gauche est à 4 de la cible 104 et à 1 de la cible 101 : 101 gagne.
    const result = snapAxis([100], [104, 101], 5)
    expect(result.delta).toBe(1)
    expect(result.guides).toEqual([101])
  })

  it("n'applique qu'une seule correction même si plusieurs bords sont proches", () => {
    // Gauche 100 / centre 150 / droite 200 ; cibles 102 et 151 : la correction
    // est +1 (centre), jamais +2 puis +1 cumulés comme avant.
    const result = snapAxis([100, 150, 200], [102, 151], 5)
    expect(result.delta).toBe(1)
  })

  it('trace tous les guides alignés après correction', () => {
    // Après +2, gauche (100→102) ET droite (200→202) tombent sur une cible.
    const result = snapAxis([100, 200], [102, 202, 400], 5)
    expect(result.delta).toBe(2)
    expect(result.guides.sort((a, b) => a - b)).toEqual([102, 202])
  })

  it('ne fait rien au-delà du seuil', () => {
    expect(snapAxis([100], [110], 5)).toEqual({ delta: 0, guides: [] })
  })

  it('gère une liste de cibles vide', () => {
    expect(snapAxis([10, 20], [], 5)).toEqual({ delta: 0, guides: [] })
  })
})

describe('nearestTarget', () => {
  it('renvoie la cible la plus proche dans le seuil', () => {
    expect(nearestTarget(100, [104, 101, 98.5], 5)).toBe(101)
  })

  it('renvoie null hors du seuil', () => {
    expect(nearestTarget(100, [120], 5)).toBeNull()
  })
})
