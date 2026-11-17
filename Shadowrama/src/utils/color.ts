/**
 * Conversions de couleurs pour le sélecteur : HEX, RGB, HSL, HSV.
 *
 * Tout passe par un hexadécimal « #rrggbb » minuscule, le format de stockage
 * des projets. HSV sert de modèle interne au sélecteur (carré saturation /
 * valeur + curseur de teinte) ; HSL n'est qu'un mode de saisie.
 */

/** Canaux 0–255. */
export interface RGB { r: number; g: number; b: number }
/** Teinte 0–360, saturation et valeur 0–1. */
export interface HSV { h: number; s: number; v: number }
/** Teinte 0–360, saturation et luminosité 0–1. */
export interface HSL { h: number; s: number; l: number }

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * « #abc », « abc », « #AABBCC » → « #aabbcc ». Null si ce n'est pas un hexa
 * (« transparent », « var(--x) », texte libre…).
 */
export function normalizeHex(input: string | undefined | null): string | null {
  if (!input) return null
  let hex = input.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(hex)) hex = hex.split('').map(c => c + c).join('')
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : null
}

export function hexToRgb(hex: string): RGB | null {
  const n = normalizeHex(hex)
  if (!n) return null
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  }
}

export function rgbToHex({ r, g, b }: RGB): string {
  const part = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

export function rgbToHsv({ r, g, b }: RGB): HSV {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
  const hh = ((h % 360) + 360) % 360
  const c = v * s
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1))
  const m = v - c
  const [r, g, b] =
    hh < 60 ? [c, x, 0]
    : hh < 120 ? [x, c, 0]
    : hh < 180 ? [0, c, x]
    : hh < 240 ? [0, x, c]
    : hh < 300 ? [x, 0, c]
    : [c, 0, x]
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) }
}

/** HSV → HSL en gardant la teinte telle quelle (elle ne se perd pas sur un gris). */
export function hsvToHsl({ h, s, v }: HSV): HSL {
  const l = v * (1 - s / 2)
  return { h, s: l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l), l }
}

export function hslToHsv({ h, s, l }: HSL): HSV {
  const v = l + s * Math.min(l, 1 - l)
  return { h, s: v === 0 ? 0 : 2 * (1 - l / v), v }
}

export const rgbToHsl = (rgb: RGB): HSL => hsvToHsl(rgbToHsv(rgb))
export const hslToRgb = (hsl: HSL): RGB => hsvToRgb(hslToHsv(hsl))

export const hexToHsv = (hex: string): HSV => rgbToHsv(hexToRgb(hex) ?? { r: 255, g: 255, b: 255 })
export const hsvToHex = (hsv: HSV): string => rgbToHex(hsvToRgb(hsv))
