import type { Slide } from '../../types'
import { boolAttr, kid, numAttr } from './xml'
import type { ThemeContext } from './theme'

/**
 * Vocabulaire commun de l'import PowerPoint : constantes, types publics,
 * parties du zip, rapport et contexte de conversion. Aucune logique de
 * conversion ici — les autres modules en dépendent tous.
 */

export const SLIDE_W = 960
export const SLIDE_H = 540
export const MAX_SLIDES = 500
export const MAX_MEDIA_BYTES = 30 * 1024 * 1024
/** Un point typographique vaut 12 700 EMU. */
export const EMU_PER_PT = 12700
/** Le bloc texte ajoute ce remplissage autour du texte (voir createTextualBlock). */
export const PAD_X = 6
export const PAD_Y = 4
/** Interligne « simple » de PowerPoint, rapporté à la taille de police. */
export const SINGLE_LINE = 1.2

// ── Types publics ────────────────────────────────────────────────────────────

export interface ImportIssue {
  /** Numéro de diapositive (à partir de 1), `null` pour une remarque globale. */
  slide: number | null
  message: string
}

export interface ImportReport {
  slideCount: number
  blockCount: number
  issues: ImportIssue[]
  /** Polices utilisées par le fichier (remplacées par la plus proche du catalogue, voir utils/fonts). */
  fonts: string[]
}

export interface ImportedMedia {
  key: string
  data: Uint8Array
  mimeType: string
}

export interface PptxImportResult {
  slides: Slide[]
  media: ImportedMedia[]
  report: ImportReport
}

export class PptxFormatError extends Error {}

// ── Parties du zip ───────────────────────────────────────────────────────────

export interface Rel {
  type: string
  /** Chemin dans le zip, déjà résolu. */
  target: string
}

export interface Part {
  path: string
  root: Element
  rels: Map<string, Rel>
  /** rId d'image → clé média. */
  images: Map<string, string>
}

// ── Rapport ──────────────────────────────────────────────────────────────────

export class Reporter {
  issues: ImportIssue[] = []
  fonts = new Set<string>()
  private seen = new Set<string>()

  add(slide: number | null, message: string) {
    const key = `${slide ?? ''}|${message}`
    if (this.seen.has(key)) return
    this.seen.add(key)
    this.issues.push({ slide, message })
  }
}

// ── Contexte de conversion ───────────────────────────────────────────────────

export interface Frame {
  /** Pixels par EMU. */
  k: number
  offX: number
  offY: number
}

/** Transformation d'un groupe : `sortie = d + entrée × s`, en EMU. */
export interface Tx {
  sx: number
  sy: number
  dx: number
  dy: number
}

export const IDENTITY: Tx = { sx: 1, sy: 1, dx: 0, dy: 0 }

export interface Ctx {
  frame: Frame
  theme: ThemeContext
  presDefault: Element | null
  master: Part | null
  layout: Part | null
  slideNo: number
  report: Reporter
  /** Vrai quand on traite le masque ou la mise en page : seuls les décors sont posés. */
  decorOnly: boolean
}

export const r1 = (v: number) => Math.round(v * 10) / 10

export interface Xfrm {
  x: number
  y: number
  cx: number
  cy: number
  rot: number
  flipH: boolean
  flipV: boolean
}

export function readXfrm(xfrm: Element | null | undefined): Xfrm | undefined {
  if (!xfrm) return undefined
  const off = kid(xfrm, 'off')
  const ext = kid(xfrm, 'ext')
  if (!off || !ext) return undefined
  return {
    x: numAttr(off, 'x') ?? 0,
    y: numAttr(off, 'y') ?? 0,
    cx: numAttr(ext, 'cx') ?? 0,
    cy: numAttr(ext, 'cy') ?? 0,
    rot: (numAttr(xfrm, 'rot') ?? 0) / 60000,
    flipH: boolAttr(xfrm, 'flipH') ?? false,
    flipV: boolAttr(xfrm, 'flipV') ?? false,
  }
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export function toBox(xf: Xfrm, tx: Tx, frame: Frame): Box {
  return {
    x: frame.offX + (tx.dx + xf.x * tx.sx) * frame.k,
    y: frame.offY + (tx.dy + xf.y * tx.sy) * frame.k,
    w: xf.cx * tx.sx * frame.k,
    h: xf.cy * tx.sy * frame.k,
  }
}
