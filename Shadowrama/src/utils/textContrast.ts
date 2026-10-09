import type { SlideBackground } from '../types'

const LIGHT_TEXT = '#ffffff'
const DARK_TEXT = '#111111'

/** Luminance relative (WCAG) d'une couleur `#rgb` / `#rrggbb`, ou null si illisible. */
function luminance(color: string | undefined): number | null {
  let hex = (color ?? '').trim().replace('#', '')
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null
  const [r, g, b] = [0, 2, 4].map(i => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Luminance du fond réellement visible. Hors Ultra, dégradé et image sont
 * inertes (voir getSlideBackgroundStyle) : on retombe alors sur le fond par
 * défaut du canvas, qui suit le thème de l'app.
 */
function backgroundLuminance(background: SlideBackground | undefined, ultra: boolean): number | null {
  if (background?.type === 'color' && background.color) return luminance(background.color)
  if (ultra && background?.type === 'gradient' && background.gradient) {
    const a = luminance(background.gradient.from)
    const b = luminance(background.gradient.to)
    return a !== null && b !== null ? (a + b) / 2 : null
  }
  // Image : contenu inconnu, on ne devine pas.
  if (ultra && background?.type === 'image' && background.image) return null
  return luminance(getComputedStyle(document.documentElement).getPropertyValue('--editor-bg-canvas'))
}

/** Noir sur fond clair, blanc sur fond sombre (ou si le fond est indéterminé). */
export function readableTextColor(background: SlideBackground | undefined, ultra: boolean): string {
  const l = backgroundLuminance(background, ultra)
  // 0.179 : seuil où le contraste avec le blanc égale celui avec le noir.
  return l !== null && l > 0.179 ? DARK_TEXT : LIGHT_TEXT
}