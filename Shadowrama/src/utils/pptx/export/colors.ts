/**
 * Couleurs CSS → couleurs PowerPoint.
 *
 * PowerPoint ne connaît que `RRGGBB` plus une opacité séparée. Les blocs, eux,
 * portent ce que l'interface a produit : `#rgb`, `#rrggbb`, `#rrggbbaa`,
 * `rgb()` / `rgba()`, voire une variable de thème (`var(--accent)`) quand le
 * champ n'a jamais été réglé.
 */

export interface Rgba {
  /** `RRGGBB`, en majuscules, sans dièse. */
  hex: string
  /** 0–1. */
  alpha: number
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const toHex = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0').toUpperCase()

export function rgba(r: number, g: number, b: number, alpha = 1): Rgba {
  return { hex: toHex(r) + toHex(g) + toHex(b), alpha: clamp01(alpha) }
}

export function channels(color: Rgba): [number, number, number] {
  return [0, 2, 4].map(i => parseInt(color.hex.slice(i, i + 2), 16)) as [number, number, number]
}

/** Rend `null` pour ce qui n'est pas une couleur lisible (variable CSS, mot-clé inconnu…). */
export function parseColor(raw: unknown): Rgba | null {
  if (typeof raw !== 'string') return null
  const text = raw.trim().toLowerCase()
  if (!text) return null
  if (text === 'transparent') return { hex: '000000', alpha: 0 }
  if (text === 'white') return { hex: 'FFFFFF', alpha: 1 }
  if (text === 'black') return { hex: '000000', alpha: 1 }

  if (text.startsWith('#')) {
    let hex = text.slice(1)
    if (!/^[0-9a-f]+$/.test(hex)) return null
    if (hex.length === 3 || hex.length === 4) hex = hex.split('').map(c => c + c).join('')
    if (hex.length === 6) return { hex: hex.toUpperCase(), alpha: 1 }
    if (hex.length === 8) return { hex: hex.slice(0, 6).toUpperCase(), alpha: parseInt(hex.slice(6), 16) / 255 }
    return null
  }

  const fn = /^rgba?\(([^)]+)\)$/.exec(text)
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean)
    if (parts.length < 3) return null
    const channel = (p: string) => (p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p))
    const [r, g, b] = parts.slice(0, 3).map(channel)
    if ([r, g, b].some(Number.isNaN)) return null
    let alpha = 1
    if (parts[3] !== undefined) {
      alpha = parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])
      if (Number.isNaN(alpha)) alpha = 1
    }
    return rgba(r, g, b, alpha)
  }

  return null
}

/** Couleur du bloc, ou repli quand elle est absente ou illisible. */
export function colorOr(raw: unknown, fallback: string): Rgba {
  return parseColor(raw) ?? parseColor(fallback) ?? { hex: '000000', alpha: 1 }
}

/** `top` posé sur `bottom` avec l'opacité `amount` (0–1). */
export function mix(bottom: Rgba, top: Rgba, amount: number): Rgba {
  const t = clamp01(amount)
  const a = channels(bottom)
  const b = channels(top)
  return rgba(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, bottom.alpha)
}

export function withOpacity(color: Rgba, opacity: number): Rgba {
  return { hex: color.hex, alpha: clamp01(color.alpha * opacity) }
}
