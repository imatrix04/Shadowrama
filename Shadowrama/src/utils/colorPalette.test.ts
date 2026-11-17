import { describe, expect, it } from 'vitest'
import { addFavorite, addRecent, MAX_FAVORITES, MAX_RECENT, parseSwatches, removeColor } from './colorPalette'
import { collectProjectColors } from './projectColors'
import type { BlockData, Slide, SlideNumbering } from '../types'
import { DEFAULT_NUMBERING } from './numbering'

describe('addRecent', () => {
  it('met la couleur en tête et normalise', () => {
    expect(addRecent(['#111111'], '#ABC')).toEqual(['#aabbcc', '#111111'])
  })

  it('ne garde pas de doublon : la couleur remonte en tête', () => {
    expect(addRecent(['#111111', '#222222', '#333333'], '#222222')).toEqual(['#222222', '#111111', '#333333'])
  })

  it('plafonne la liste en jetant la plus ancienne', () => {
    const full = Array.from({ length: MAX_RECENT }, (_, i) => `#0000${i.toString(16).padStart(2, '0')}`)
    const next = addRecent(full, '#ffffff')
    expect(next).toHaveLength(MAX_RECENT)
    expect(next[0]).toBe('#ffffff')
    expect(next).not.toContain(full[MAX_RECENT - 1])
  })

  it('ignore une valeur qui n\'est pas une couleur', () => {
    const list = ['#111111']
    expect(addRecent(list, 'transparent')).toBe(list)
  })
})

describe('favoris', () => {
  it("ajoute en fin de liste, sans doublon", () => {
    expect(addFavorite(['#111111'], '#222222')).toEqual(['#111111', '#222222'])
    const list = ['#111111']
    expect(addFavorite(list, '#111111')).toBe(list)
  })

  it('refuse au-delà du plafond', () => {
    const full = Array.from({ length: MAX_FAVORITES }, (_, i) => `#0000${i.toString(16).padStart(2, '0')}`)
    expect(addFavorite(full, '#ffffff')).toBe(full)
  })

  it('retire une couleur', () => {
    expect(removeColor(['#111111', '#222222'], '#111111')).toEqual(['#222222'])
  })
})

describe('parseSwatches', () => {
  it('lit un stockage valide', () => {
    expect(parseSwatches('{"recent":["#111111"],"favorites":["#222222"]}'))
      .toEqual({ recent: ['#111111'], favorites: ['#222222'] })
  })

  it('écarte les valeurs invalides et les doublons', () => {
    const parsed = parseSwatches('{"recent":["#111111","nope",42,"#111111","#ABC"],"favorites":"x"}')
    expect(parsed).toEqual({ recent: ['#111111', '#aabbcc'], favorites: [] })
  })

  it('tolère un stockage absent ou corrompu', () => {
    for (const raw of [null, '', '{pas du json', '42', 'null']) {
      expect(parseSwatches(raw)).toEqual({ recent: [], favorites: [] })
    }
  })
})

const NUMBERING: SlideNumbering = DEFAULT_NUMBERING

const block = (extra: Record<string, unknown>) =>
  ({ id: 1, type: 'shape', x: 0, y: 0, width: 10, height: 10, ...extra }) as unknown as BlockData

describe('collectProjectColors', () => {
  it('compte les couleurs des blocs, des effets, des fonds et de la numérotation', () => {
    const slides: Slide[] = [{
      id: 1,
      blocks: [
        block({ backgroundColor: '#ff0000', borderColor: '#00ff00', effects: { shadow: { x: 0, y: 0, blur: 1, color: '#0000ff' } } }),
        block({ id: 2, type: 'text', color: '#ff0000' }),
      ],
      background: { type: 'gradient', gradient: { from: '#111111', to: '#222222', angle: 0 }, overlay: { color: '#333333', opacity: 0.5 } },
    }]
    const colors = collectProjectColors(slides, { ...NUMBERING, color: '#444444' })
    expect(colors[0]).toBe('#ff0000') // utilisée deux fois : en tête
    expect(colors).toEqual(expect.arrayContaining(['#00ff00', '#0000ff', '#111111', '#222222', '#333333', '#444444']))
  })

  it('ignore transparent, les variables CSS et les valeurs absentes', () => {
    const slides: Slide[] = [{ id: 1, blocks: [block({ backgroundColor: 'transparent', color: 'var(--accent)', borderColor: undefined })] }]
    expect(collectProjectColors(slides, NUMBERING)).toEqual([])
  })

  it('fusionne les écritures équivalentes (#ABC, #aabbcc)', () => {
    const slides: Slide[] = [{ id: 1, blocks: [block({ color: '#ABC' }), block({ id: 2, color: '#aabbcc' })] }]
    expect(collectProjectColors(slides, NUMBERING)).toEqual(['#aabbcc'])
  })

  it('plafonne le nombre de couleurs', () => {
    const blocks = Array.from({ length: 30 }, (_, i) => block({ id: i, color: `#0000${i.toString(16).padStart(2, '0')}` }))
    expect(collectProjectColors([{ id: 1, blocks }], NUMBERING, 12)).toHaveLength(12)
  })
})
