import { describe, expect, it } from 'vitest'
import { FONT_CATALOG, FONT_OPTIONS, findFont, fontFromPptx, fontStack, normalizeFontFamily } from './fonts'

describe('catalogue de polices', () => {
  it('couvre les trois familles, sans doublon', () => {
    const groups = new Set(FONT_CATALOG.map(f => f.group))
    expect([...groups].sort()).toEqual(['creative', 'hand', 'pro'])
    expect(new Set(FONT_CATALOG.map(f => f.id)).size).toBe(FONT_CATALOG.length)
  })

  it('propose « Par défaut » en tête du sélecteur', () => {
    expect(FONT_OPTIONS[0]).toEqual({ label: 'Par défaut', value: '' })
    expect(FONT_OPTIONS).toHaveLength(FONT_CATALOG.length + 1)
  })

  it('retrouve une police sans tenir compte de la casse, et ignore le reste', () => {
    expect(findFont('inter')?.id).toBe('Inter')
    expect(normalizeFontFamily(' Caveat ')).toBe('Caveat')
    expect(normalizeFontFamily('Comic Sans')).toBeUndefined()
    expect(normalizeFontFamily(42)).toBeUndefined()
    expect(fontStack('Pacifico')).toContain("'Pacifico'")
    expect(fontStack(undefined)).toBeUndefined()
  })
})

describe('fontFromPptx', () => {
  it('reprend une police du catalogue telle quelle', () => {
    expect(fontFromPptx('Montserrat')).toBe('Montserrat')
  })

  it('approche les autres par le genre de la police', () => {
    expect(fontFromPptx('Times New Roman')).toBe('Merriweather')
    expect(fontFromPptx('Courier New')).toBe('IBM Plex Mono')
    expect(fontFromPptx('Brush Script MT')).toBe('Caveat')
    expect(fontFromPptx('Impact')).toBe('Oswald')
  })

  it('laisse la police par défaut pour une police sans empattement ou absente', () => {
    expect(fontFromPptx('Calibri')).toBeUndefined()
    expect(fontFromPptx('Arial')).toBeUndefined()
    expect(fontFromPptx(undefined)).toBeUndefined()
  })
})
