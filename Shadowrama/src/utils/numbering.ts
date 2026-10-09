import type {
  Keyframe, NumberingAnimation, NumberingCustomMotion, NumberingFormat,
  NumberingPosition, SlideNumbering,
} from '../types'

export const NUMBERING_FORMATS: { value: NumberingFormat; label: string }[] = [
  { value: 'n', label: '3' },
  { value: 'nn', label: '03' },
  { value: 'n-total', label: '3 / 12' },
  { value: 'roman', label: 'III' },
]

export const NUMBERING_POSITIONS: NumberingPosition[] = [
  'top-left', 'top-center', 'top-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]

export const POSITION_LABELS: Record<NumberingPosition, string> = {
  'top-left': 'Haut gauche',
  'top-center': 'Haut centre',
  'top-right': 'Haut droite',
  'bottom-left': 'Bas gauche',
  'bottom-center': 'Bas centre',
  'bottom-right': 'Bas droite',
}

/** Animations propres à la numérotation, en plus des presets d'entrée. */
export const COUNT_PRESET = 'count'
export const CUSTOM_PRESET = 'custom'

export const NUMBERING_EASES: { value: string; label: string }[] = [
  { value: 'power2.out', label: 'Douce' },
  { value: 'power4.out', label: 'Vive' },
  { value: 'back.out(1.7)', label: 'Rebond léger' },
  { value: 'elastic.out(1, 0.5)', label: 'Élastique' },
  { value: 'expo.out', label: 'Explosive' },
  { value: 'sine.inOut', label: 'Fluide' },
]

export const DEFAULT_CUSTOM_MOTION: NumberingCustomMotion = {
  from: { opacity: 0, y: 24, scale: 0.8, rotate: 0, blur: 0 },
  duration: 0.8,
  ease: 'power2.out',
}

export const DEFAULT_NUMBERING: SlideNumbering = {
  enabled: false,
  format: 'n',
  position: 'bottom-right',
  size: 18,
  opacity: 0.7,
  bold: false,
  startAt: 1,
  skipFirst: false,
}

const FORMATS: NumberingFormat[] = ['n', 'nn', 'n-total', 'roman']

const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
]

export function toRoman(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0'
  let rest = Math.min(Math.round(n), 3999)
  let out = ''
  for (const [value, symbol] of ROMAN) {
    while (rest >= value) {
      out += symbol
      rest -= value
    }
  }
  return out
}

/** Numéro affiché pour la diapositive d'index `index` (0 = première). */
export function slideNumberValue(index: number, numbering: SlideNumbering): number {
  return index + numbering.startAt
}

/** Le numéro de la dernière diapositive : sert au format « 3 / 12 ». */
export function lastNumberValue(total: number, numbering: SlideNumbering): number {
  return total - 1 + numbering.startAt
}

export function formatNumber(value: number, last: number, format: NumberingFormat): string {
  const n = Math.max(0, Math.round(value))
  switch (format) {
    case 'nn': return String(n).padStart(2, '0')
    case 'n-total': return `${n} / ${last}`
    case 'roman': return toRoman(n)
    default: return String(n)
  }
}

/**
 * Texte du numéro d'une diapositive, ou `null` si elle n'en porte pas
 * (numérotation coupée, ou première diapositive exclue).
 */
export function slideNumberText(index: number, total: number, numbering: SlideNumbering): string | null {
  if (!numbering.enabled) return null
  if (numbering.skipFirst && index === 0) return null
  return formatNumber(
    slideNumberValue(index, numbering),
    lastNumberValue(total, numbering),
    numbering.format,
  )
}

// ── Lecture défensive (brouillon, .shma) ─────────────────────────────────────

function num(raw: unknown, min: number, max: number, fallback: number): number {
  return typeof raw === 'number' && Number.isFinite(raw)
    ? Math.min(max, Math.max(min, raw))
    : fallback
}

function normalizeKeyframe(raw: unknown): Keyframe {
  if (!raw || typeof raw !== 'object') return {}
  const k = raw as Record<string, unknown>
  const out: Keyframe = {}
  if (typeof k.opacity === 'number') out.opacity = num(k.opacity, 0, 1, 1)
  if (typeof k.x === 'number') out.x = num(k.x, -1000, 1000, 0)
  if (typeof k.y === 'number') out.y = num(k.y, -1000, 1000, 0)
  if (typeof k.scale === 'number') out.scale = num(k.scale, 0, 10, 1)
  if (typeof k.rotate === 'number') out.rotate = num(k.rotate, -720, 720, 0)
  if (typeof k.skewX === 'number') out.skewX = num(k.skewX, -90, 90, 0)
  if (typeof k.skewY === 'number') out.skewY = num(k.skewY, -90, 90, 0)
  if (typeof k.blur === 'number') out.blur = num(k.blur, 0, 60, 0)
  return out
}

function normalizeAnimation(raw: unknown): NumberingAnimation | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const a = raw as Record<string, unknown>
  if (typeof a.preset !== 'string' || !a.preset) return undefined
  const animation: NumberingAnimation = { preset: a.preset }
  if (typeof a.speed === 'number') animation.speed = num(a.speed, 0.25, 3, 1)
  if (typeof a.delay === 'number') animation.delay = num(a.delay, 0, 10, 0)
  if (a.custom && typeof a.custom === 'object') {
    const c = a.custom as Record<string, unknown>
    animation.custom = {
      from: normalizeKeyframe(c.from),
      duration: num(c.duration, 0.1, 5, DEFAULT_CUSTOM_MOTION.duration),
      ease: typeof c.ease === 'string' && c.ease ? c.ease : DEFAULT_CUSTOM_MOTION.ease,
    }
  }
  return animation
}

/** Remet un réglage lu sur disque dans une forme sûre ; défauts si absent. */
export function normalizeNumbering(raw: unknown): SlideNumbering {
  if (!raw || typeof raw !== 'object') return DEFAULT_NUMBERING
  const n = raw as Record<string, unknown>
  const d = DEFAULT_NUMBERING

  const numbering: SlideNumbering = {
    enabled: n.enabled === true,
    format: FORMATS.includes(n.format as NumberingFormat) ? (n.format as NumberingFormat) : d.format,
    position: NUMBERING_POSITIONS.includes(n.position as NumberingPosition)
      ? (n.position as NumberingPosition)
      : d.position,
    size: num(n.size, 8, 120, d.size),
    opacity: num(n.opacity, 0.05, 1, d.opacity),
    bold: n.bold === true,
    startAt: Math.round(num(n.startAt, 0, 9999, d.startAt)),
    skipFirst: n.skipFirst === true,
  }
  if (typeof n.color === 'string' && n.color) numbering.color = n.color
  const animation = normalizeAnimation(n.animation)
  if (animation) numbering.animation = animation
  return numbering
}