import JSZip from 'jszip'
import type {
  BlockData, ImageBlockData, ShapeBlockData, ShapeKind, Slide, SlideBackground,
  SlideTransitionSettings, TextBlockData, TitleBlockData,
} from '../../types'
import { nextId } from '../ids'
import { attr, boolAttr, descendants, kid, kids, numAttr, parseXml, path, relAttr } from './xml'
import { loadTheme, readColor, readSolid } from './theme'
import type { ColorValue, ThemeContext } from './theme'

/**
 * Import d'un diaporama PowerPoint (.pptx) vers des diapositives Shadowrama.
 *
 * Module pur : octets en entrée, diapositives + médias + rapport en sortie. Il
 * ne touche ni au store média ni au disque, ce qui le rend testable seul. Le
 * résultat doit repasser par la couche de normalisation de `fileManager` avant
 * d'atteindre l'éditeur (voir `importPowerPoint`).
 *
 * Principe : conversion « au mieux ». Ce qu'on ne sait pas représenter (tableaux,
 * graphiques, SmartArt, polices…) est ignoré ou approché, et listé dans le
 * rapport plutôt que de disparaître sans explication.
 */

const SLIDE_W = 960
const SLIDE_H = 540
const MAX_SLIDES = 500
const MAX_MEDIA_BYTES = 30 * 1024 * 1024
/** Un point typographique vaut 12 700 EMU. */
const EMU_PER_PT = 12700
/** Le bloc texte ajoute ce remplissage autour du texte (voir createTextualBlock). */
const PAD_X = 6
const PAD_Y = 4
/** Interligne « simple » de PowerPoint, rapporté à la taille de police. */
const SINGLE_LINE = 1.2

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
  /** Polices utilisées par le fichier (Shadowrama n'a pas encore de choix de police). */
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

interface Rel {
  type: string
  /** Chemin dans le zip, déjà résolu. */
  target: string
}

interface Part {
  path: string
  root: Element
  rels: Map<string, Rel>
  /** rId d'image → clé média. */
  images: Map<string, string>
}

function resolveTarget(basePath: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  const parts = basePath.split('/').slice(0, -1)
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.' && seg !== '') parts.push(seg)
  }
  return parts.join('/')
}

async function readText(zip: JSZip, filePath: string): Promise<string | null> {
  const file = zip.file(filePath)
  return file ? file.async('string') : null
}

async function loadRels(zip: JSZip, partPath: string): Promise<Map<string, Rel>> {
  const dir = partPath.split('/').slice(0, -1).join('/')
  const name = partPath.split('/').pop() ?? ''
  const relsPath = `${dir ? `${dir}/` : ''}_rels/${name}.rels`
  const rels = new Map<string, Rel>()
  const text = await readText(zip, relsPath)
  if (!text) return rels
  try {
    for (const r of Array.from(parseXml(text).children)) {
      const id = attr(r, 'Id')
      const target = attr(r, 'Target')
      const type = attr(r, 'Type') ?? ''
      if (!id || !target || attr(r, 'TargetMode') === 'External') continue
      rels.set(id, { type, target: resolveTarget(partPath, target) })
    }
  } catch {
    /* des relations illisibles privent la diapo de ses images, pas du reste */
  }
  return rels
}

async function loadPart(zip: JSZip, partPath: string): Promise<Part | null> {
  const text = await readText(zip, partPath)
  if (!text) return null
  try {
    return { path: partPath, root: parseXml(text), rels: await loadRels(zip, partPath), images: new Map() }
  } catch {
    return null
  }
}

function relOfType(part: Part | null, suffix: string): Rel | undefined {
  if (!part) return undefined
  for (const rel of part.rels.values()) {
    if (rel.type.endsWith(suffix)) return rel
  }
  return undefined
}

// ── Rapport ──────────────────────────────────────────────────────────────────

class Reporter {
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

interface Frame {
  /** Pixels par EMU. */
  k: number
  offX: number
  offY: number
}

/** Transformation d'un groupe : `sortie = d + entrée × s`, en EMU. */
interface Tx {
  sx: number
  sy: number
  dx: number
  dy: number
}

const IDENTITY: Tx = { sx: 1, sy: 1, dx: 0, dy: 0 }

interface Ctx {
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

const r1 = (v: number) => Math.round(v * 10) / 10

interface Xfrm {
  x: number
  y: number
  cx: number
  cy: number
  rot: number
  flipH: boolean
  flipV: boolean
}

function readXfrm(xfrm: Element | null | undefined): Xfrm | undefined {
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

interface Box {
  x: number
  y: number
  w: number
  h: number
}

function toBox(xf: Xfrm, tx: Tx, frame: Frame): Box {
  return {
    x: frame.offX + (tx.dx + xf.x * tx.sx) * frame.k,
    y: frame.offY + (tx.dy + xf.y * tx.sy) * frame.k,
    w: xf.cx * tx.sx * frame.k,
    h: xf.cy * tx.sy * frame.k,
  }
}

// ── Placeholders ─────────────────────────────────────────────────────────────

interface PhInfo {
  type?: string
  idx?: string
}

function readPh(sp: Element): PhInfo | null {
  const ph = path(sp, 'nvSpPr', 'nvPr', 'ph') ?? path(sp, 'nvPicPr', 'nvPr', 'ph')
  if (!ph) return null
  return { type: attr(ph, 'type'), idx: attr(ph, 'idx') }
}

function normalizePhType(type: string | undefined): string {
  if (!type) return 'body'
  if (type === 'ctrTitle') return 'title'
  if (type === 'subTitle' || type === 'obj') return 'body'
  return type
}

function findPlaceholder(part: Part | null, ph: PhInfo): Element | null {
  const tree = path(part?.root, 'cSld', 'spTree')
  if (!tree) return null
  const wanted = normalizePhType(ph.type)
  let byType: Element | null = null
  for (const sp of kids(tree, 'sp')) {
    const cand = readPh(sp)
    if (!cand) continue
    if (ph.idx !== undefined && cand.idx === ph.idx) return sp
    if (!byType && normalizePhType(cand.type) === wanted) byType = sp
  }
  return byType
}

// ── Couleurs et remplissages ─────────────────────────────────────────────────

type Fill =
  | { kind: 'none' }
  | { kind: 'solid'; color: ColorValue }
  | { kind: 'gradient'; from: ColorValue; to: ColorValue; angle: number }
  | { kind: 'unsupported'; what: string }

function readGradient(grad: Element, theme: ThemeContext, phColor?: string): Fill {
  const stops = kids(kid(grad, 'gsLst'), 'gs')
    .map(gs => ({ pos: numAttr(gs, 'pos') ?? 0, color: readColor(kids(gs)[0], theme, phColor) }))
    .filter((s): s is { pos: number; color: ColorValue } => !!s.color)
    .sort((a, b) => a.pos - b.pos)
  if (stops.length === 0) return { kind: 'none' }
  const lin = kid(grad, 'lin')
  // OOXML : 0° = vers la droite, sens horaire. CSS : 0° = vers le haut.
  const angle = ((numAttr(lin, 'ang') ?? 5400000) / 60000 + 90) % 360
  return { kind: 'gradient', from: stops[0].color, to: stops[stops.length - 1].color, angle }
}

function readFillElement(el: Element, theme: ThemeContext, phColor?: string): Fill | undefined {
  switch (el.localName) {
    case 'noFill': return { kind: 'none' }
    case 'solidFill': {
      const color = readSolid(el, theme, phColor)
      return color ? { kind: 'solid', color } : { kind: 'none' }
    }
    case 'gradFill': return readGradient(el, theme, phColor)
    case 'pattFill': {
      const color = readSolid(kid(el, 'fgClr'), theme, phColor)
      return color ? { kind: 'solid', color } : { kind: 'none' }
    }
    case 'blipFill': return { kind: 'unsupported', what: 'remplissage par image' }
    default: return undefined
  }
}

const FILL_NAMES = ['noFill', 'solidFill', 'gradFill', 'pattFill', 'blipFill', 'grpFill']

/** Remplissage d'une forme : explicite d'abord, sinon celui du style du thème. */
function resolveShapeFill(spPr: Element | null, sp: Element, theme: ThemeContext): Fill {
  for (const child of kids(spPr)) {
    if (!FILL_NAMES.includes(child.localName)) continue
    const fill = readFillElement(child, theme)
    if (fill) return fill
  }
  const ref = path(sp, 'style', 'fillRef')
  if (ref && (numAttr(ref, 'idx') ?? 0) > 0) {
    const color = readColor(kids(ref)[0], theme)
    if (color) return { kind: 'solid', color }
  }
  return { kind: 'none' }
}

interface Stroke {
  color: string
  /** Pixels. */
  width: number
}

function resolveStroke(spPr: Element | null, sp: Element, ctx: Ctx): Stroke | undefined {
  const ln = kid(spPr, 'ln')
  if (ln) {
    const widthEmu = numAttr(ln, 'w') ?? EMU_PER_PT
    for (const child of kids(ln)) {
      if (child.localName === 'noFill') return undefined
      if (child.localName === 'solidFill') {
        const color = readSolid(child, ctx.theme)
        if (color) return { color: color.hex, width: Math.max(0.5, r1(widthEmu * ctx.frame.k)) }
      }
      if (child.localName === 'gradFill') {
        const g = readGradient(child, ctx.theme)
        if (g.kind === 'gradient') return { color: g.from.hex, width: Math.max(0.5, r1(widthEmu * ctx.frame.k)) }
      }
    }
  }
  const ref = path(sp, 'style', 'lnRef')
  if (!ln && ref && (numAttr(ref, 'idx') ?? 0) > 0) {
    const color = readColor(kids(ref)[0], ctx.theme)
    if (color) return { color: color.hex, width: Math.max(0.5, r1(EMU_PER_PT * ctx.frame.k)) }
  }
  return undefined
}

// ── Géométries ───────────────────────────────────────────────────────────────

type Pt = [number, number]

interface ShapeSpec {
  shape: ShapeKind
  borderRadius: number
  customShape?: Pt[]
  /** Forme approchée par un rectangle : à signaler. */
  approximated?: string
}

const POLYGONS: Record<string, Pt[]> = {
  diamond: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]],
  parallelogram: [[0.2, 0], [1, 0], [0.8, 1], [0, 1]],
  trapezoid: [[0.2, 0], [0.8, 0], [1, 1], [0, 1]],
  pentagon: [[0.5, 0], [1, 0.38], [0.81, 1], [0.19, 1], [0, 0.38]],
  homePlate: [[0, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0, 1]],
  chevron: [[0, 0], [0.7, 0], [1, 0.5], [0.7, 1], [0, 1], [0.3, 0.5]],
  octagon: [[0.29, 0], [0.71, 0], [1, 0.29], [1, 0.71], [0.71, 1], [0.29, 1], [0, 0.71], [0, 0.29]],
  snip1Rect: [[0, 0], [0.85, 0], [1, 0.15], [1, 1], [0, 1]],
  rtTriangle: [[0, 0], [1, 1], [0, 1]],
}

/** Réglage d'arrondi d'une forme prédéfinie : `<a:gd name="adj" fmla="val 4376"/>`. */
function readAdjust(prstEl: Element | null): number | undefined {
  const guides = kids(kid(prstEl, 'avLst'), 'gd')
  const guide = guides.find(g => attr(g, 'name') === 'adj') ?? guides[0]
  const match = /val\s+(-?\d+)/.exec(attr(guide, 'fmla') ?? '')
  return match ? Number(match[1]) : undefined
}

function presetSpec(prst: string, adj: number | undefined, box: Box): ShapeSpec {
  switch (prst) {
    case 'rect':
    case 'flowChartProcess':
      return { shape: 'rectangle', borderRadius: 0 }
    case 'roundRect': {
      const ratio = (adj ?? 16667) / 100000
      return { shape: 'rectangle', borderRadius: r1(Math.min(box.w, box.h) * Math.min(ratio, 0.5)) }
    }
    case 'ellipse':
    case 'flowChartConnector':
      return { shape: 'circle', borderRadius: 0 }
    case 'triangle':
      return { shape: 'triangle', borderRadius: 0 }
    case 'rightArrow': return { shape: 'arrow-right', borderRadius: 0 }
    case 'leftArrow': return { shape: 'arrow-left', borderRadius: 0 }
    case 'upArrow': return { shape: 'arrow-up', borderRadius: 0 }
    case 'downArrow': return { shape: 'arrow-down', borderRadius: 0 }
    case 'star5': return { shape: 'star', borderRadius: 0 }
    case 'hexagon': return { shape: 'hexagon', borderRadius: 0 }
    case 'line':
    case 'straightConnector1':
      return { shape: 'line', borderRadius: 0 }
    default: {
      const poly = POLYGONS[prst]
      if (poly) return { shape: 'grid', borderRadius: 0, customShape: poly }
      return { shape: 'rectangle', borderRadius: 0, approximated: prst }
    }
  }
}

/** Aplatit un tracé personnalisé (`custGeom`) en polygone normalisé 0–1. */
function custGeomToPolygon(cust: Element): Pt[] | undefined {
  const pathEl = kid(kid(cust, 'pathLst'), 'path')
  if (!pathEl) return undefined
  const w = numAttr(pathEl, 'w')
  const h = numAttr(pathEl, 'h')
  if (!w || !h) return undefined

  const pts: Pt[] = []
  let cur: Pt = [0, 0]
  const point = (p: Element | null): Pt => [numAttr(p, 'x') ?? 0, numAttr(p, 'y') ?? 0]

  for (const cmd of kids(pathEl)) {
    switch (cmd.localName) {
      case 'moveTo':
      case 'lnTo': {
        cur = point(kid(cmd, 'pt'))
        pts.push(cur)
        break
      }
      case 'arcTo': {
        const wR = numAttr(cmd, 'wR') ?? 0
        const hR = numAttr(cmd, 'hR') ?? 0
        const st = ((numAttr(cmd, 'stAng') ?? 0) / 60000) * (Math.PI / 180)
        const sw = ((numAttr(cmd, 'swAng') ?? 0) / 60000) * (Math.PI / 180)
        const cx = cur[0] - wR * Math.cos(st)
        const cy = cur[1] - hR * Math.sin(st)
        const steps = 6
        for (let i = 1; i <= steps; i++) {
          const a = st + (sw * i) / steps
          cur = [cx + wR * Math.cos(a), cy + hR * Math.sin(a)]
          pts.push(cur)
        }
        break
      }
      case 'quadBezTo':
      case 'cubicBezTo': {
        const ctrl = kids(cmd, 'pt').map(p => point(p))
        const start = cur
        const steps = 8
        for (let i = 1; i <= steps; i++) {
          const t = i / steps
          const u = 1 - t
          if (ctrl.length === 2) {
            cur = [
              u * u * start[0] + 2 * u * t * ctrl[0][0] + t * t * ctrl[1][0],
              u * u * start[1] + 2 * u * t * ctrl[0][1] + t * t * ctrl[1][1],
            ]
          } else if (ctrl.length === 3) {
            cur = [
              u ** 3 * start[0] + 3 * u * u * t * ctrl[0][0] + 3 * u * t * t * ctrl[1][0] + t ** 3 * ctrl[2][0],
              u ** 3 * start[1] + 3 * u * u * t * ctrl[0][1] + 3 * u * t * t * ctrl[1][1] + t ** 3 * ctrl[2][1],
            ]
          }
          pts.push(cur)
        }
        break
      }
      default:
        break
    }
  }

  // Points consécutifs identiques : ils ne servent à rien et gênent l'arrondi.
  const clean = pts.filter((p, i) => i === 0 || Math.abs(p[0] - pts[i - 1][0]) + Math.abs(p[1] - pts[i - 1][1]) > 0.5)
  if (clean.length < 3) return undefined
  return clean.map(([x, y]) => [
    Math.min(1, Math.max(0, Math.round((x / w) * 1000) / 1000)),
    Math.min(1, Math.max(0, Math.round((y / h) * 1000) / 1000)),
  ])
}

// ── Style de texte ───────────────────────────────────────────────────────────

interface RunProps {
  sz?: number
  b?: boolean
  i?: boolean
  cap?: string
  spc?: number
  color?: ColorValue
  font?: string
}

interface ParaProps {
  algn?: string
  lnPct?: number
  lnPts?: number
  spcBefPts?: number
  spcBefPct?: number
  spcAftPts?: number
  spcAftPct?: number
  bu?: 'none' | 'char' | 'auto'
  buChar?: string
  run: RunProps
}

function parseRPr(el: Element | null | undefined, theme: ThemeContext): RunProps {
  if (!el) return {}
  const out: RunProps = {}
  const sz = numAttr(el, 'sz')
  if (sz !== undefined) out.sz = sz
  const b = boolAttr(el, 'b')
  if (b !== undefined) out.b = b
  const i = boolAttr(el, 'i')
  if (i !== undefined) out.i = i
  const cap = attr(el, 'cap')
  if (cap) out.cap = cap
  const spc = numAttr(el, 'spc')
  if (spc !== undefined) out.spc = spc

  const solid = kid(el, 'solidFill')
  if (solid) {
    out.color = readSolid(solid, theme)
  } else {
    const grad = kid(el, 'gradFill')
    if (grad) {
      const g = readGradient(grad, theme)
      if (g.kind === 'gradient') out.color = g.from
    }
  }

  const latin = attr(kid(el, 'latin'), 'typeface')
  if (latin) {
    out.font = latin === '+mj-lt' ? theme.majorFont : latin === '+mn-lt' ? theme.minorFont : latin
  }
  return out
}

function parsePPr(el: Element | null | undefined, theme: ThemeContext): ParaProps {
  const out: ParaProps = { run: {} }
  if (!el) return out
  const algn = attr(el, 'algn')
  if (algn) out.algn = algn

  const ln = kid(el, 'lnSpc')
  if (ln) {
    const pct = numAttr(kid(ln, 'spcPct'), 'val')
    const pts = numAttr(kid(ln, 'spcPts'), 'val')
    if (pct !== undefined) out.lnPct = pct
    if (pts !== undefined) out.lnPts = pts
  }
  const bef = kid(el, 'spcBef')
  if (bef) {
    out.spcBefPts = numAttr(kid(bef, 'spcPts'), 'val')
    out.spcBefPct = numAttr(kid(bef, 'spcPct'), 'val')
  }
  const aft = kid(el, 'spcAft')
  if (aft) {
    out.spcAftPts = numAttr(kid(aft, 'spcPts'), 'val')
    out.spcAftPct = numAttr(kid(aft, 'spcPct'), 'val')
  }

  if (kid(el, 'buNone')) out.bu = 'none'
  const buChar = kid(el, 'buChar')
  if (buChar) {
    out.bu = 'char'
    out.buChar = attr(buChar, 'char') ?? '•'
  }
  if (kid(el, 'buAutoNum')) out.bu = 'auto'

  out.run = parseRPr(kid(el, 'defRPr'), theme)
  return out
}

function mergeRun(base: RunProps, over: RunProps): RunProps {
  const out: RunProps = { ...base }
  for (const key of Object.keys(over) as (keyof RunProps)[]) {
    if (over[key] !== undefined) (out as Record<string, unknown>)[key] = over[key]
  }
  return out
}

function mergePara(base: ParaProps, over: ParaProps): ParaProps {
  const out: ParaProps = { ...base, run: mergeRun(base.run, over.run) }
  for (const key of Object.keys(over) as (keyof ParaProps)[]) {
    if (key === 'run') continue
    if (over[key] !== undefined) (out as unknown as Record<string, unknown>)[key] = over[key]
  }
  return out
}

// ── Texte ────────────────────────────────────────────────────────────────────

interface TextStyle {
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
  align: 'left' | 'center' | 'right'
  lineHeight: number
  letterSpacing: number
}

interface ParaOut {
  text: string
  style: TextStyle
  /** Pixels. */
  before: number
  after: number
}

function alignOf(algn: string | undefined): TextStyle['align'] {
  if (algn === 'ctr') return 'center'
  if (algn === 'r') return 'right'
  return 'left'
}

function estimateLines(text: string, width: number, fontSize: number, letterSpacing: number): number {
  const charWidth = fontSize * 0.52 + letterSpacing
  let lines = 0
  for (const line of text.split('\n')) {
    lines += Math.max(1, Math.ceil((line.length * charWidth) / Math.max(1, width)))
  }
  return lines
}

interface TextEnv {
  sp: Element
  ph: PhInfo | null
  phLayout: Element | null
  phMaster: Element | null
}

function styleContainers(env: TextEnv, ctx: Ctx): (Element | null)[] {
  const list: (Element | null)[] = [ctx.presDefault]
  if (env.ph) {
    const kind = normalizePhType(env.ph.type)
    const txStyles = path(ctx.master?.root, 'txStyles')
    const style = kind === 'title' ? 'titleStyle' : kind === 'body' ? 'bodyStyle' : 'otherStyle'
    list.push(kid(txStyles, style))
    list.push(path(env.phMaster, 'txBody', 'lstStyle'))
    list.push(path(env.phLayout, 'txBody', 'lstStyle'))
  }
  list.push(path(env.sp, 'txBody', 'lstStyle'))
  return list
}

function bodyPrValue(env: TextEnv, name: string): string | undefined {
  return attr(path(env.sp, 'txBody', 'bodyPr'), name)
    ?? attr(path(env.phLayout, 'txBody', 'bodyPr'), name)
    ?? attr(path(env.phMaster, 'txBody', 'bodyPr'), name)
}

function emitText(
  env: TextEnv, box: Box, rotation: number | undefined, ctx: Ctx, blocks: BlockData[],
) {
  const body = kid(env.sp, 'txBody')
  if (!body) return
  const paragraphs = kids(body, 'p')
  const pxPerPt = ctx.frame.k * EMU_PER_PT

  const bodyPr = kid(body, 'bodyPr')
  const autofit = kid(bodyPr, 'normAutofit')
  const fontScale = (numAttr(autofit, 'fontScale') ?? 100000) / 100000

  const inset = (name: string, fallback: number) => {
    const v = Number(bodyPrValue(env, name))
    return (Number.isFinite(v) && bodyPrValue(env, name) !== undefined ? v : fallback) * ctx.frame.k
  }
  const left = inset('lIns', 91440)
  const right = inset('rIns', 91440)
  const top = inset('tIns', 45720)
  const bottom = inset('bIns', 45720)

  const anchor = bodyPrValue(env, 'anchor')
  const verticalAlign: 'top' | 'middle' | 'bottom' = anchor === 'ctr' ? 'middle' : anchor === 'b' ? 'bottom' : 'top'

  const containers = styleContainers(env, ctx)
  const out: ParaOut[] = []
  let mixed = false
  let autoNum = 0

  for (const p of paragraphs) {
    const pPr = kid(p, 'pPr')
    const lvl = Math.min(8, Math.max(0, numAttr(pPr, 'lvl') ?? 0))
    let props: ParaProps = { run: {} }
    for (const c of containers) props = mergePara(props, parsePPr(kid(c, `lvl${lvl + 1}pPr`), ctx.theme))
    props = mergePara(props, parsePPr(pPr, ctx.theme))

    interface Piece { text: string; run: RunProps }
    const pieces: Piece[] = []
    for (const child of kids(p)) {
      if (child.localName === 'r' || child.localName === 'fld') {
        const run = mergeRun(props.run, parseRPr(kid(child, 'rPr'), ctx.theme))
        let text = kid(child, 't')?.textContent ?? ''
        if (run.cap === 'all') text = text.toUpperCase()
        pieces.push({ text, run })
        if (run.font) ctx.report.fonts.add(run.font)
      } else if (child.localName === 'br') {
        pieces.push({ text: '\n', run: props.run })
      }
    }

    const text = pieces.map(x => x.text).join('')
    const visible = pieces.filter(x => x.text.trim() !== '')
    // Le style retenu est celui qui porte le plus de caractères.
    let dominant = props.run
    let best = -1
    for (const piece of visible) {
      if (piece.text.length > best) {
        best = piece.text.length
        dominant = piece.run
      }
    }
    if (visible.length === 0) {
      dominant = mergeRun(props.run, parseRPr(kid(p, 'endParaRPr'), ctx.theme))
    }
    if (visible.some(x => x.run.sz !== dominant.sz || x.run.b !== dominant.b || x.run.i !== dominant.i
      || x.run.color?.hex !== dominant.color?.hex)) {
      mixed = true
    }

    const fontPx = Math.max(1, r1(((dominant.sz ?? 1800) / 100) * pxPerPt * fontScale))
    let lineHeight = SINGLE_LINE
    if (props.lnPts !== undefined) lineHeight = (props.lnPts / 100) * pxPerPt / fontPx
    else if (props.lnPct !== undefined) lineHeight = (props.lnPct / 100000) * SINGLE_LINE
    lineHeight = Math.min(3, Math.max(0.8, Math.round(lineHeight * 100) / 100))

    // Puces : un préfixe de texte, faute de vraie liste dans les blocs.
    let prefix = ''
    if (props.bu === 'char' && visible.length > 0) {
      prefix = `${props.buChar ?? '•'} `
      autoNum = 0
    } else if (props.bu === 'auto' && visible.length > 0) {
      autoNum += 1
      prefix = `${autoNum}. `
    } else {
      autoNum = 0
    }

    const spacing = (pts?: number, pct?: number) =>
      pts !== undefined ? (pts / 100) * pxPerPt : pct !== undefined ? (pct / 100000) * fontPx * SINGLE_LINE : 0

    out.push({
      text: prefix + text,
      style: {
        fontSize: fontPx,
        color: dominant.color?.hex ?? '#000000',
        bold: dominant.b ?? false,
        italic: dominant.i ?? false,
        align: alignOf(props.algn),
        lineHeight,
        letterSpacing: dominant.spc !== undefined ? r1((dominant.spc / 100) * pxPerPt) : 0,
      },
      before: spacing(props.spcBefPts, props.spcBefPct),
      after: spacing(props.spcAftPts, props.spcAftPct),
    })
  }

  // Rien de lisible : ni bloc ni bruit.
  if (out.every(p => p.text.trim() === '')) return
  // Les paragraphes vides en tête et en queue décaleraient le texte pour rien.
  while (out.length > 0 && out[0].text.trim() === '') out.shift()
  while (out.length > 0 && out[out.length - 1].text.trim() === '') out.pop()

  if (mixed) ctx.report.add(ctx.slideNo, 'Texte à mise en forme mixte (tailles, couleurs, gras…) : le style dominant est appliqué.')

  // Regroupe les paragraphes consécutifs de même style : un seul bloc suffit.
  interface Group { style: TextStyle; lines: string[]; gap: number }
  const groups: Group[] = []
  for (const [i, para] of out.entries()) {
    const key = JSON.stringify(para.style)
    const last = groups[groups.length - 1]
    const prevAfter = i > 0 ? out[i - 1].after : 0
    if (last && JSON.stringify(last.style) === key && para.before === 0 && prevAfter === 0) {
      last.lines.push(para.text)
    } else {
      groups.push({ style: para.style, lines: [para.text], gap: last ? prevAfter + para.before : 0 })
    }
  }

  const title = env.ph ? normalizePhType(env.ph.type) === 'title' : false
  const make = (g: Group, rect: Box, v: 'top' | 'middle' | 'bottom', rot: number | undefined): BlockData => {
    const common = {
      id: nextId(),
      x: r1(rect.x), y: r1(rect.y), width: Math.max(20, r1(rect.w)), height: Math.max(20, r1(rect.h)),
      content: g.lines.join('\n'),
      fontSize: g.style.fontSize,
      color: g.style.color,
      textAlign: g.style.align,
      verticalAlign: v,
      fontWeight: g.style.bold ? 'bold' as const : 'normal' as const,
      fontStyle: g.style.italic ? 'italic' as const : 'normal' as const,
      lineHeight: g.style.lineHeight,
      letterSpacing: g.style.letterSpacing,
      ...(rot ? { rotation: r1(rot) } : {}),
    }
    return title
      ? ({ type: 'title', ...common } as TitleBlockData)
      : ({ type: 'text', ...common } as TextBlockData)
  }

  const inner: Box = {
    x: box.x + left - PAD_X,
    y: box.y + top - PAD_Y,
    w: box.w - left - right + 2 * PAD_X,
    h: box.h - top - bottom + 2 * PAD_Y,
  }

  if (groups.length === 1) {
    blocks.push(make(groups[0], inner, verticalAlign, rotation))
    return
  }

  // Plusieurs styles : un bloc par groupe, empilés selon une hauteur estimée.
  if (rotation) ctx.report.add(ctx.slideNo, 'Texte pivoté à plusieurs styles : la rotation n\'est pas conservée.')
  const textWidth = Math.max(1, box.w - left - right)
  const heights = groups.map(g => estimateLines(g.lines.join('\n'), textWidth, g.style.fontSize, g.style.letterSpacing)
    * g.style.fontSize * g.style.lineHeight)
  const total = heights.reduce((a, b) => a + b, 0) + groups.reduce((a, g) => a + g.gap, 0)
  const available = box.h - top - bottom
  let cursor = box.y + top
  if (verticalAlign === 'middle') cursor = box.y + top + (available - total) / 2
  else if (verticalAlign === 'bottom') cursor = box.y + top + available - total

  groups.forEach((g, i) => {
    cursor += g.gap
    blocks.push(make(g, { x: inner.x, y: cursor - PAD_Y, w: inner.w, h: heights[i] + 2 * PAD_Y }, 'top', undefined))
    cursor += heights[i]
  })
}

// ── Formes, images, groupes ──────────────────────────────────────────────────

function emitLine(
  sp: Element, xf: Xfrm, box: Box, ctx: Ctx, blocks: BlockData[],
) {
  const spPr = kid(sp, 'spPr')
  const stroke = resolveStroke(spPr, sp, ctx)
  if (!stroke) return
  // Le bloc « ligne » est un trait horizontal centré : on le place au milieu du
  // segment, à sa longueur, et on l'incline.
  const length = Math.hypot(box.w, box.h)
  if (length < 1) return
  let angle = (Math.atan2(box.h, box.w) * 180) / Math.PI
  if (xf.flipH !== xf.flipV) angle = -angle
  const thickness = Math.max(2, stroke.width)
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  const block: ShapeBlockData = {
    id: nextId(), type: 'shape', shape: 'line',
    x: r1(cx - length / 2), y: r1(cy - thickness / 2), width: r1(length), height: r1(thickness),
    backgroundColor: stroke.color, borderWidth: thickness,
    ...(angle + xf.rot !== 0 ? { rotation: r1(angle + xf.rot) } : {}),
  }
  blocks.push(block)
}

function emitShape(sp: Element, ctx: Ctx, tx: Tx, blocks: BlockData[]) {
  const ph = readPh(sp)
  if (ph && ['sldNum', 'dt', 'ftr', 'hdr'].includes(ph.type ?? '')) return
  // Les placeholders du masque et de la mise en page sont des modèles, pas du contenu.
  if (ctx.decorOnly && ph) return

  const spPr = kid(sp, 'spPr')
  const phLayout = ph ? findPlaceholder(ctx.layout, ph) : null
  const phMaster = ph ? findPlaceholder(ctx.master, ph) : null

  const xf = readXfrm(kid(spPr, 'xfrm'))
    ?? readXfrm(path(phLayout, 'spPr', 'xfrm'))
    ?? readXfrm(path(phMaster, 'spPr', 'xfrm'))
  if (!xf) {
    if (kid(sp, 'txBody')?.textContent?.trim()) {
      ctx.report.add(ctx.slideNo, 'Un texte sans position connue a été ignoré.')
    }
    return
  }
  const box = toBox(xf, tx, ctx.frame)
  const rotation = xf.rot !== 0 ? xf.rot : undefined

  const prstEl = kid(spPr, 'prstGeom')
  const custEl = kid(spPr, 'custGeom')
  const prst = attr(prstEl, 'prst') ?? (custEl ? 'custom' : 'rect')

  if (prst === 'line' || prst === 'straightConnector1') {
    emitLine(sp, xf, box, ctx, blocks)
    return
  }

  const fill = resolveShapeFill(spPr, sp, ctx.theme)
  const stroke = resolveStroke(spPr, sp, ctx)
  const hasGeometry = !!prstEl || !!custEl

  if (fill.kind === 'unsupported') ctx.report.add(ctx.slideNo, `Un ${fill.what} n'est pas pris en charge (forme laissée sans remplissage).`)

  // Une forme n'est posée que si elle se voit : un cadre de texte sans fond ni
  // bordure ne produit que son texte.
  const visible = hasGeometry && (fill.kind === 'solid' || fill.kind === 'gradient' || !!stroke)
  if (visible) {
    let spec: ShapeSpec
    if (custEl) {
      const polygon = custGeomToPolygon(custEl)
      spec = polygon
        ? { shape: 'grid', borderRadius: 0, customShape: polygon }
        : { shape: 'rectangle', borderRadius: 0, approximated: 'tracé personnalisé' }
    } else {
      spec = presetSpec(prst, readAdjust(prstEl), box)
    }
    if (spec.approximated) ctx.report.add(ctx.slideNo, `Forme « ${spec.approximated} » approchée par un rectangle.`)

    const block: ShapeBlockData = {
      id: nextId(), type: 'shape', shape: spec.shape,
      x: r1(box.x), y: r1(box.y), width: Math.max(1, r1(box.w)), height: Math.max(1, r1(box.h)),
      backgroundColor: 'transparent',
      borderRadius: spec.borderRadius,
      ...(spec.customShape ? { customShape: spec.customShape } : {}),
      ...(rotation ? { rotation: r1(rotation) } : {}),
    }
    if (fill.kind === 'solid') {
      block.backgroundColor = fill.color.hex
      if (fill.color.alpha < 1) block.opacity = Math.round(fill.color.alpha * 100) / 100
    } else if (fill.kind === 'gradient') {
      block.backgroundColor = fill.from.hex
      block.effects = { gradient: { from: fill.from.hex, to: fill.to.hex, angle: Math.round(fill.angle) } }
    }
    if (stroke) {
      block.borderColor = stroke.color
      block.borderWidth = stroke.width
    }
    blocks.push(block)
  }

  emitText({ sp, ph, phLayout, phMaster }, box, rotation, ctx, blocks)
}

function emitPicture(pic: Element, part: Part, ctx: Ctx, tx: Tx, blocks: BlockData[]) {
  const ph = readPh(pic)
  const spPr = kid(pic, 'spPr')
  const xf = readXfrm(kid(spPr, 'xfrm'))
    ?? readXfrm(path(ph ? findPlaceholder(ctx.layout, ph) : null, 'spPr', 'xfrm'))
  if (!xf) return
  const embed = relAttr(kid(kid(pic, 'blipFill'), 'blip'), 'embed')
  const key = embed ? part.images.get(embed) : undefined
  if (!key) {
    ctx.report.add(ctx.slideNo, 'Une image dans un format non pris en charge (SVG, EMF, TIFF…) a été ignorée.')
    return
  }
  const box = toBox(xf, tx, ctx.frame)
  const src = kid(kid(pic, 'blipFill'), 'srcRect')
  const cropped = ['l', 'r', 't', 'b'].some(n => (numAttr(src, n) ?? 0) > 0)
  if (cropped) ctx.report.add(ctx.slideNo, 'Recadrage d\'image approché (image remplie dans son cadre).')

  const prst = attr(kid(spPr, 'prstGeom'), 'prst')
  const radius = prst === 'ellipse' ? Math.min(box.w, box.h) / 2
    : prst === 'roundRect' ? Math.min(box.w, box.h) * 0.16667 : 0

  const block: ImageBlockData = {
    id: nextId(), type: 'image', src: key,
    x: r1(box.x), y: r1(box.y), width: Math.max(1, r1(box.w)), height: Math.max(1, r1(box.h)),
    objectFit: cropped ? 'cover' : 'fill',
    ...(radius > 0 ? { borderRadius: r1(radius) } : {}),
    ...(xf.rot !== 0 ? { rotation: r1(xf.rot) } : {}),
  }
  const alt = attr(path(pic, 'nvPicPr', 'cNvPr'), 'descr')
  if (alt) block.alt = alt
  blocks.push(block)
}

function walkTree(tree: Element, part: Part, ctx: Ctx, tx: Tx, blocks: BlockData[]) {
  for (const node of kids(tree)) {
    switch (node.localName) {
      case 'sp':
      case 'cxnSp':
        emitShape(node, ctx, tx, blocks)
        break
      case 'pic':
        if (!ctx.decorOnly || !readPh(node)) emitPicture(node, part, ctx, tx, blocks)
        break
      case 'grpSp': {
        const xf = kid(kid(node, 'grpSpPr'), 'xfrm')
        const off = kid(xf, 'off')
        const ext = kid(xf, 'ext')
        const chOff = kid(xf, 'chOff')
        const chExt = kid(xf, 'chExt')
        const chW = numAttr(chExt, 'cx') || 1
        const chH = numAttr(chExt, 'cy') || 1
        const sx = (numAttr(ext, 'cx') ?? chW) / chW
        const sy = (numAttr(ext, 'cy') ?? chH) / chH
        const next: Tx = {
          sx: tx.sx * sx,
          sy: tx.sy * sy,
          dx: tx.dx + ((numAttr(off, 'x') ?? 0) - (numAttr(chOff, 'x') ?? 0) * sx) * tx.sx,
          dy: tx.dy + ((numAttr(off, 'y') ?? 0) - (numAttr(chOff, 'y') ?? 0) * sy) * tx.sy,
        }
        if (xf && (numAttr(xf, 'rot') ?? 0) !== 0) ctx.report.add(ctx.slideNo, 'Rotation d\'un groupe ignorée.')
        walkTree(node, part, ctx, next, blocks)
        break
      }
      case 'AlternateContent': {
        const choice = kid(node, 'Fallback') ?? kid(node, 'Choice')
        if (choice) walkTree(choice, part, ctx, tx, blocks)
        break
      }
      case 'graphicFrame': {
        const uri = attr(descendants(node, 'graphicData')[0], 'uri') ?? ''
        const what = uri.includes('table') ? 'tableau'
          : uri.includes('chart') ? 'graphique'
          : uri.includes('diagram') ? 'SmartArt'
          : 'objet intégré'
        ctx.report.add(ctx.slideNo, `Un ${what} n'est pas pris en charge et a été ignoré.`)
        break
      }
      default:
        break
    }
  }
}

// ── Fonds et transitions ─────────────────────────────────────────────────────

function backgroundOf(part: Part | null, ctx: Ctx): SlideBackground | undefined {
  const bg = path(part?.root, 'cSld', 'bg')
  if (!bg) return undefined
  const bgPr = kid(bg, 'bgPr')
  if (bgPr) {
    for (const child of kids(bgPr)) {
      if (child.localName === 'blipFill') {
        const embed = relAttr(kid(child, 'blip'), 'embed')
        const key = embed ? part?.images.get(embed) : undefined
        if (key) return { type: 'image', image: key, imageFit: 'cover', color: '#1a1a2e' }
        ctx.report.add(ctx.slideNo, 'Fond image dans un format non pris en charge.')
        return undefined
      }
      const fill = readFillElement(child, ctx.theme)
      if (!fill) continue
      if (fill.kind === 'solid') return { type: 'color', color: fill.color.hex }
      if (fill.kind === 'gradient') {
        return {
          type: 'gradient',
          // Hors mode Ultra seul `color` est lu : la première couleur sert de repli.
          color: fill.from.hex,
          gradient: { from: fill.from.hex, to: fill.to.hex, angle: Math.round(fill.angle) },
        }
      }
    }
    return undefined
  }
  const ref = kid(bg, 'bgRef')
  const color = readColor(kids(ref)[0], ctx.theme)
  return color ? { type: 'color', color: color.hex } : undefined
}

function transitionOf(slideRoot: Element): SlideTransitionSettings | undefined {
  const tr = descendants(slideRoot, 'transition')[0]
  if (!tr) return undefined
  const effect = kids(tr).find(k => k.localName !== 'sndAc')
  if (!effect) return undefined
  const dir = attr(effect, 'dir')
  let preset: string | undefined
  switch (effect.localName) {
    case 'fade': preset = 'fade'; break
    case 'push':
    case 'cover':
    case 'pull':
    case 'wipe':
      preset = dir === 'u' || dir === 'd' ? 'slide-up' : 'slide'
      break
    case 'zoom': preset = 'zoom'; break
    case 'cut': return undefined
    default: preset = 'fade'
  }
  const dur = numAttr(tr, 'dur')
  const speed = dur ? Math.min(3, Math.max(0.25, 600 / dur)) : undefined
  return { preset, ...(speed && Math.abs(speed - 1) > 0.05 ? { speed: Math.round(speed * 100) / 100 } : {}) }
}

// ── Médias ───────────────────────────────────────────────────────────────────

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
}

interface MediaRegistry {
  byPath: Map<string, string | null>
  list: ImportedMedia[]
}

async function prepareImages(zip: JSZip, part: Part | null, registry: MediaRegistry, report: Reporter, slideNo: number) {
  if (!part) return
  for (const [id, rel] of part.rels) {
    if (!rel.type.endsWith('/image')) continue
    let key = registry.byPath.get(rel.target)
    if (key === undefined) {
      const ext = (rel.target.split('.').pop() ?? '').toLowerCase()
      const mime = MIME_BY_EXT[ext]
      const file = zip.file(rel.target)
      key = null
      if (mime && file) {
        const data = await file.async('uint8array')
        if (data.length <= MAX_MEDIA_BYTES) {
          key = `media/pptx-${registry.list.length + 1}.${ext === 'jpeg' ? 'jpg' : ext}`
          registry.list.push({ key, data, mimeType: mime })
        } else {
          report.add(slideNo, 'Une image de plus de 30 Mo a été ignorée.')
        }
      }
      registry.byPath.set(rel.target, key)
    }
    if (key) part.images.set(id, key)
  }
}

// ── Point d'entrée ───────────────────────────────────────────────────────────

export async function importPptx(data: ArrayBuffer | Uint8Array): Promise<PptxImportResult> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(data)
  } catch {
    throw new PptxFormatError("Ce fichier n'est pas une présentation PowerPoint (.pptx) valide.")
  }

  const presText = await readText(zip, 'ppt/presentation.xml')
  if (!presText) throw new PptxFormatError("Ce fichier n'est pas une présentation PowerPoint (.pptx) valide.")
  let presRoot: Element
  try {
    presRoot = parseXml(presText)
  } catch {
    throw new PptxFormatError('La présentation est illisible.')
  }
  const presRels = await loadRels(zip, 'ppt/presentation.xml')

  const size = kid(presRoot, 'sldSz')
  const cx = numAttr(size, 'cx') || 12192000
  const cy = numAttr(size, 'cy') || 6858000
  // La scène fait 960×540 : une diapo d'un autre format est ajustée et centrée.
  const k = Math.min(SLIDE_W / cx, SLIDE_H / cy)
  const frame: Frame = { k, offX: (SLIDE_W - cx * k) / 2, offY: (SLIDE_H - cy * k) / 2 }

  const report = new Reporter()
  if (Math.abs(cx / cy - 16 / 9) > 0.02) {
    report.add(null, 'Format de diapositive différent du 16:9 : le contenu est ajusté et centré.')
  }

  const slideIds = kids(kid(presRoot, 'sldIdLst'), 'sldId')
  if (slideIds.length === 0) throw new PptxFormatError('Cette présentation ne contient aucune diapositive.')
  if (slideIds.length > MAX_SLIDES) {
    report.add(null, `Seules les ${MAX_SLIDES} premières diapositives sont importées.`)
  }

  const registry: MediaRegistry = { byPath: new Map(), list: [] }
  const partCache = new Map<string, Part | null>()
  const cached = async (p: string) => {
    if (!partCache.has(p)) partCache.set(p, await loadPart(zip, p))
    return partCache.get(p) ?? null
  }
  const presDefault = kid(presRoot, 'defaultTextStyle')

  const slides: Slide[] = []
  let blockCount = 0

  for (const [index, sldId] of slideIds.slice(0, MAX_SLIDES).entries()) {
    const slideNo = index + 1
    const rel = presRels.get(relAttr(sldId, 'id') ?? '')
    const slidePart = rel ? await loadPart(zip, rel.target) : null
    if (!slidePart) {
      report.add(slideNo, 'Diapositive illisible : remplacée par une diapositive vide.')
      slides.push({ id: nextId(), blocks: [] })
      continue
    }

    const layoutRel = relOfType(slidePart, '/slideLayout')
    const layout = layoutRel ? await cached(layoutRel.target) : null
    const masterRel = relOfType(layout, '/slideMaster')
    const master = masterRel ? await cached(masterRel.target) : null
    const themeRel = relOfType(master, '/theme')
    const themePart = themeRel ? await cached(themeRel.target) : null
    const theme = loadTheme(themePart?.root ?? null, kid(master?.root, 'clrMap'))

    await prepareImages(zip, slidePart, registry, report, slideNo)
    await prepareImages(zip, layout, registry, report, slideNo)
    await prepareImages(zip, master, registry, report, slideNo)

    const base: Omit<Ctx, 'decorOnly'> = { frame, theme, presDefault, master, layout, slideNo, report }
    const blocks: BlockData[] = []

    // Décors du masque puis de la mise en page, sous le contenu de la diapo.
    const showMaster = attr(slidePart.root, 'showMasterSp') !== '0'
    if (showMaster) {
      const decorOf = (part: Part | null, showParent: boolean) => {
        const tree = path(part?.root, 'cSld', 'spTree')
        if (tree && showParent) walkTree(tree, part as Part, { ...base, decorOnly: true }, IDENTITY, blocks)
      }
      if (attr(layout?.root, 'showMasterSp') !== '0') decorOf(master, true)
      decorOf(layout, true)
    }

    const tree = path(slidePart.root, 'cSld', 'spTree')
    if (tree) walkTree(tree, slidePart, { ...base, decorOnly: false }, IDENTITY, blocks)

    const ctx: Ctx = { ...base, decorOnly: false }
    const slide: Slide = { id: nextId(), blocks }
    const background = backgroundOf(slidePart, ctx) ?? backgroundOf(layout, ctx) ?? backgroundOf(master, ctx)
    if (background) slide.background = background
    const transition = transitionOf(slidePart.root)
    if (transition) slide.transition = transition

    blockCount += blocks.length
    slides.push(slide)
  }

  if (report.fonts.size > 0) {
    report.add(null, `Polices du fichier : ${[...report.fonts].join(', ')}. Shadowrama n'a pas encore de choix de police : la police par défaut est utilisée.`)
  }

  return {
    slides,
    media: registry.list,
    report: {
      slideCount: slides.length,
      blockCount,
      issues: report.issues,
      fonts: [...report.fonts],
    },
  }
}

/** Texte lisible du rapport, pour la boîte de dialogue qui suit l'import. */
export function formatImportReport(report: ImportReport): string {
  const lines = [`${report.slideCount} diapositive${report.slideCount > 1 ? 's' : ''} et ${report.blockCount} élément${report.blockCount > 1 ? 's' : ''} importés.`]
  if (report.issues.length === 0) return lines[0]
  lines.push('', 'À vérifier :')
  const MAX = 15
  for (const issue of report.issues.slice(0, MAX)) {
    lines.push(`• ${issue.slide ? `Diapo ${issue.slide} : ` : ''}${issue.message}`)
  }
  if (report.issues.length > MAX) lines.push(`• … et ${report.issues.length - MAX} autre(s) remarque(s).`)
  return lines.join('\n')
}