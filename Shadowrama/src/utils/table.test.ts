import { describe, expect, it } from 'vitest'
import { MAX_TABLE_COLS, MAX_TABLE_ROWS, normalizeCells, parseDelimited, resizeCells, toCsv } from './table'

describe('normalizeCells', () => {
  it('complète les lignes courtes et convertit les nombres en texte', () => {
    expect(normalizeCells([['a', 'b', 'c'], ['d'], [1, 2.5]])).toEqual([['a', 'b', 'c'], ['d', '', ''], ['1', '2.5', '']])
  })

  it('rend toujours une grille exploitable', () => {
    expect(normalizeCells(undefined)).toEqual([['']])
    expect(normalizeCells('abc')).toEqual([['']])
    expect(normalizeCells([null, 3, ['x']])).toEqual([[''], [''], ['x']])
  })

  it('borne lignes, colonnes et longueur des cellules', () => {
    const big = Array.from({ length: 80 }, () => Array.from({ length: 40 }, () => 'x'.repeat(1000)))
    const out = normalizeCells(big)
    expect(out).toHaveLength(MAX_TABLE_ROWS)
    expect(out[0]).toHaveLength(MAX_TABLE_COLS)
    expect(out[0][0].length).toBe(300)
  })
})

describe('parseDelimited', () => {
  it('lit un collage tabulé (Excel)', () => {
    expect(parseDelimited('Nom\tPrix\nThé\t3\n')).toEqual([['Nom', 'Prix'], ['Thé', '3']])
  })

  it('lit du CSV en ; ou en , avec guillemets', () => {
    expect(parseDelimited('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']])
    expect(parseDelimited('a,b\r\n"x, y","il dit ""oui"""')).toEqual([['a', 'b'], ['x, y', 'il dit "oui"']])
  })

  it('accepte un retour à la ligne dans une cellule entre guillemets', () => {
    expect(parseDelimited('a;b\n"l1\nl2";z')).toEqual([['a', 'b'], ['l1\nl2', 'z']])
  })

  it('rend une liste vide pour du texte vide', () => {
    expect(parseDelimited('  \n')).toEqual([])
  })
})

describe('toCsv', () => {
  it('fait un aller-retour avec parseDelimited, y compris les cas piégeux', () => {
    const cells = [['Nom', 'Note'], ['a;b', 'il dit "oui"'], ['l1\nl2', '']]
    expect(parseDelimited(toCsv(cells))).toEqual(cells)
  })
})

describe('resizeCells', () => {
  it('ajoute et retire des lignes et colonnes sans descendre sous 1×1', () => {
    expect(resizeCells([['a']], 2, 2)).toEqual([['a', ''], ['', '']])
    expect(resizeCells([['a', 'b'], ['c', 'd']], 1, 1)).toEqual([['a']])
    expect(resizeCells([['a']], 0, 0)).toEqual([['a']])
  })
})
