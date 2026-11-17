import { describe, expect, it } from 'vitest'
import {
  hexToHsv, hexToRgb, hslToRgb, hsvToHex, hsvToRgb, normalizeHex, rgbToHex, rgbToHsl, rgbToHsv,
} from './color'

describe('normalizeHex', () => {
  it('accepte 3 ou 6 chiffres, avec ou sans #, quelle que soit la casse', () => {
    expect(normalizeHex('#FF6B4A')).toBe('#ff6b4a')
    expect(normalizeHex('ff6b4a')).toBe('#ff6b4a')
    expect(normalizeHex('#f60')).toBe('#ff6600')
    expect(normalizeHex('  F60 ')).toBe('#ff6600')
  })

  it("rejette ce qui n'est pas un hexadécimal", () => {
    for (const bad of ['', 'transparent', 'var(--accent)', '#12', '#12345', '#gggggg', '#1234567', undefined, null]) {
      expect(normalizeHex(bad)).toBeNull()
    }
  })
})

describe('conversions', () => {
  it('hex ↔ rgb', () => {
    expect(hexToRgb('#ff6b4a')).toEqual({ r: 255, g: 107, b: 74 })
    expect(rgbToHex({ r: 255, g: 107, b: 74 })).toBe('#ff6b4a')
    expect(hexToRgb('nope')).toBeNull()
  })

  it('borne les canaux hors plage', () => {
    expect(rgbToHex({ r: 300, g: -5, b: 127.6 })).toBe('#ff0080')
  })

  it('valeurs de référence en HSV', () => {
    expect(rgbToHsv({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 1, v: 1 })
    expect(rgbToHsv({ r: 0, g: 255, b: 0 }).h).toBe(120)
    expect(rgbToHsv({ r: 0, g: 0, b: 255 }).h).toBe(240)
    expect(rgbToHsv({ r: 128, g: 128, b: 128 }).s).toBe(0)
    expect(rgbToHsv({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, v: 0 })
  })

  it('valeurs de référence en HSL', () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 1, l: 0.5 })
    expect(rgbToHsl({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, l: 1 })
    const grey = rgbToHsl({ r: 128, g: 128, b: 128 })
    expect(grey.s).toBe(0)
    expect(grey.l).toBeCloseTo(0.502, 3)
  })

  it('hsl → rgb', () => {
    expect(hslToRgb({ h: 0, s: 1, l: 0.5 })).toEqual({ r: 255, g: 0, b: 0 })
    expect(hslToRgb({ h: 240, s: 1, l: 0.5 })).toEqual({ r: 0, g: 0, b: 255 })
    expect(hslToRgb({ h: 0, s: 0, l: 1 })).toEqual({ r: 255, g: 255, b: 255 })
  })

  it('une teinte hors plage est ramenée dans 0–360', () => {
    expect(hsvToRgb({ h: 360, s: 1, v: 1 })).toEqual({ r: 255, g: 0, b: 0 })
    expect(hsvToRgb({ h: -120, s: 1, v: 1 })).toEqual({ r: 0, g: 0, b: 255 })
  })

  it("l'aller-retour hex → HSV → hex ne perd rien, sur tout l'espace", () => {
    for (let r = 0; r < 256; r += 17) {
      for (let g = 0; g < 256; g += 17) {
        for (let b = 0; b < 256; b += 17) {
          const hex = rgbToHex({ r, g, b })
          expect(hsvToHex(hexToHsv(hex))).toBe(hex)
        }
      }
    }
  })

  it("l'aller-retour hex → HSL → hex ne perd rien", () => {
    for (const hex of ['#ff6b4a', '#1c1814', '#f4ede0', '#7c6cff', '#2de2e6', '#808080', '#010203']) {
      const rgb = hexToRgb(hex)!
      expect(rgbToHex(hslToRgb(rgbToHsl(rgb)))).toBe(hex)
    }
  })
})
