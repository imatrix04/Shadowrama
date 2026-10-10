import { attr, kid, kids, numAttr, path } from './xml'

export interface ColorValue {
  /** `#rrggbb` */
  hex: string
  /** 0–1 */
  alpha: number
}

export interface ThemeContext {
  /** dk1, lt1, accent1… → `rrggbb` */
  colors: Record<string, string>
  /** bg1 → lt1, tx1 → dk1… (table de correspondance du masque) */
  clrMap: Record<string, string>
  majorFont?: string
  minorFont?: string
}

const DEFAULT_CLR_MAP: Record<string, string> = {
  bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2',
  accent1: 'accent1', accent2: 'accent2', accent3: 'accent3',
  accent4: 'accent4', accent5: 'accent5', accent6: 'accent6',
  hlink: 'hlink', folHlink: 'folHlink',
}

const PRESET_COLORS: Record<string, string> = {
  black: '000000', white: 'ffffff', red: 'ff0000', green: '008000', blue: '0000ff',
  yellow: 'ffff00', gray: '808080', grey: '808080', orange: 'ffa500', purple: '800080',
  cyan: '00ffff', magenta: 'ff00ff', silver: 'c0c0c0', maroon: '800000', navy: '000080',
  lime: '00ff00', teal: '008080', pink: 'ffc0cb', brown: 'a52a2a',
  dkGray: 'a9a9a9', ltGray: 'd3d3d3', dkBlue: '00008b', ltBlue: 'add8e6',
}

export function loadTheme(themeRoot: Element | null, clrMapEl: Element | null): ThemeContext {
  const colors: Record<string, string> = {}
  const scheme = path(themeRoot, 'themeElements', 'clrScheme')
  for (const slot of kids(scheme)) {
    const child = kids(slot)[0]
    if (!child) continue
    const value = attr(child, 'val') ?? attr(child, 'lastClr')
    const hex = child.localName === 'sysClr' ? (attr(child, 'lastClr') ?? value) : value
    if (hex && /^[0-9a-fA-F]{6}$/.test(hex)) colors[slot.localName] = hex.toLowerCase()
  }

  const clrMap = { ...DEFAULT_CLR_MAP }
  if (clrMapEl) {
    for (const a of Array.from(clrMapEl.attributes)) clrMap[a.localName] = a.value
  }

  const fonts = path(themeRoot, 'themeElements', 'fontScheme')
  return {
    colors,
    clrMap,
    majorFont: attr(path(fonts, 'majorFont', 'latin'), 'typeface'),
    minorFont: attr(path(fonts, 'minorFont', 'latin'), 'typeface'),
  }
}

// ── Conversions de couleur ───────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `${c(r)}${c(g)}${c(b)}`
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return [h / 6, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue = (t: number) => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  return [hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255]
}

/** Applique les modificateurs enfants (`lumMod`, `alpha`…) à une couleur de base. */
function applyTransforms(baseHex: string, colorEl: Element): ColorValue {
  let [r, g, b] = hexToRgb(baseHex)
  let alpha = 1

  for (const t of kids(colorEl)) {
    const val = (numAttr(t, 'val') ?? 0) / 100000
    switch (t.localName) {
      case 'alpha': alpha = val; break
      case 'alphaMod': alpha *= val; break
      case 'alphaOff': alpha += val; break
      case 'lumMod':
      case 'lumOff':
      case 'satMod':
      case 'satOff': {
        const [h, s, l] = rgbToHsl(r, g, b)
        let ns = s
        let nl = l
        if (t.localName === 'lumMod') nl = l * val
        else if (t.localName === 'lumOff') nl = l + val
        else if (t.localName === 'satMod') ns = s * val
        else ns = s + val
        ;[r, g, b] = hslToRgb(h, Math.min(1, Math.max(0, ns)), Math.min(1, Math.max(0, nl)))
        break
      }
      case 'tint': // vers le blanc
        r = 255 - (255 - r) * val
        g = 255 - (255 - g) * val
        b = 255 - (255 - b) * val
        break
      case 'shade': // vers le noir
        r *= val
        g *= val
        b *= val
        break
      default:
        break
    }
  }

  return { hex: `#${rgbToHex(r, g, b)}`, alpha: Math.min(1, Math.max(0, alpha)) }
}

/**
 * Lit un élément couleur (`srgbClr`, `schemeClr`, `sysClr`, `prstClr`).
 * `phColor` sert aux couleurs `phClr` des styles de thème.
 */
export function readColor(colorEl: Element | null | undefined, theme: ThemeContext, phColor?: string): ColorValue | undefined {
  if (!colorEl) return undefined
  let base: string | undefined

  switch (colorEl.localName) {
    case 'srgbClr': {
      const v = attr(colorEl, 'val')
      if (v && /^[0-9a-fA-F]{6}$/.test(v)) base = v.toLowerCase()
      break
    }
    case 'sysClr':
      base = (attr(colorEl, 'lastClr') ?? (attr(colorEl, 'val') === 'window' ? 'ffffff' : '000000')).toLowerCase()
      break
    case 'prstClr':
      base = PRESET_COLORS[attr(colorEl, 'val') ?? '']
      break
    case 'schemeClr': {
      const val = attr(colorEl, 'val') ?? ''
      if (val === 'phClr') {
        base = phColor?.replace('#', '')
      } else {
        const slot = theme.clrMap[val] ?? val
        base = theme.colors[slot]
      }
      break
    }
    default:
      break
  }

  return base ? applyTransforms(base, colorEl) : undefined
}

/** Couleur d'un conteneur de remplissage uni (`solidFill`, `fgClr`…). */
export function readSolid(solidEl: Element | null | undefined, theme: ThemeContext, phColor?: string): ColorValue | undefined {
  const colorEl = solidEl ? kids(solidEl)[0] : undefined
  return readColor(colorEl, theme, phColor)
}

export { kid }