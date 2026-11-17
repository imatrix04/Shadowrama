import JSZip from 'jszip'
import type {
  BlockData, BlockEffects, Gradient, ImageBlockData, ShapeBlockData, Slide, SlideNumbering,
  TextBlockData, TitleBlockData,
} from '../../../types'
import { getSlideTransition } from '../../../ultra/slideTransitions'
import { slideNumberText } from '../../numbering'
import { normalizePolygon } from '../../shapePolygon'
import { shapePoints } from '../../shapePoints'
import type { Point } from '../../shapePoints'
import { luminance } from '../../textContrast'
import type { ImportIssue } from '../context'
import { colorOr, withOpacity } from './colors'
import type { Rgba } from './colors'
import {
  FONT, NS, NS_ATTRS, REL, TREE_HEAD, XML_HEAD,
  appPropsXml, contentTypesXml, corePropsXml, esc, presentationRelsXml, presentationXml,
  relsXml, rootRelsXml, slideLayoutRelsXml, slideLayoutXml, slideMasterRelsXml, slideMasterXml, themeXml,
} from './parts'
import type { Relationship } from './parts'
import type { BackgroundPlan, ExportDefaults, ExportPlan, SlidePlan } from './plan'

/**
 * Écriture du .pptx à partir du plan d'export (voir `plan`).
 *
 * Module pur : diapositives, plan et images déjà capturées en entrée, octets du
 * fichier en sortie. Il ne touche ni à l'écran ni au disque, ce qui permet de
 * le tester en relisant son résultat avec l'import PowerPoint de l'application.
 *
 * Unités : la scène fait 960 × 540 px et la diapositive PowerPoint 16:9
 * standard 12 192 000 × 6 858 000 EMU, soit 12 700 EMU par pixel — exactement
 * un point typographique. Un texte de 24 px s'écrit donc 24 pt, sans conversion.
 */

export interface RasterImage {
  bytes: Uint8Array
  mimeType: 'image/png' | 'image/jpeg'
}

export interface ExportAssets {
  /** Images capturées, par identifiant de tâche (voir `CaptureJob`). */
  rasters: Map<string, RasterImage>
  /** Octets d'un média du projet (`media/…`). */
  loadMedia: (key: string) => Promise<Uint8Array | undefined>
  /** Dimensions naturelles d'une image du projet, pour calculer un recadrage. */
  imageSize: (key: string) => Promise<{ width: number; height: number } | undefined>
}

export interface ExportReport {
  slideCount: number
  /** Éléments restés modifiables dans PowerPoint. */
  editableCount: number
  /** Éléments exportés en image. */
  imageCount: number
  issues: ImportIssue[]
}

export interface ExportOptions {
  ultra: boolean
  defaults: ExportDefaults
  title: string
}

const EMU = 12700
const emu = (px: number) => Math.round(px * EMU)
/** Angles OOXML : soixante-millièmes de degré, sens horaire, dans [0, 360°[. */
const ang = (deg: number) => Math.round((((deg % 360) + 360) % 360) * 60000)
const pct = (ratio: number) => Math.round(Math.min(1, Math.max(0, ratio)) * 100000)

/** Remplissage que le bloc texte ajoute autour du texte (voir createTextualBlock). */
const PAD_X = 6
const PAD_Y = 4
/** Interligne « simple » de PowerPoint, rapporté à la taille de police. */
const SINGLE_LINE = 1.2

const EXT_BY_MIME: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpeg' }
const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', gif: 'image/gif',
  mp4: 'video/mp4', m4v: 'video/x-m4v', mov: 'video/quicktime',
}

// ── Briques DrawingML ────────────────────────────────────────────────────────

function colorXml(color: Rgba): string {
  const alpha = color.alpha < 1 ? `<a:alpha val="${pct(color.alpha)}"/>` : ''
  return `<a:srgbClr val="${color.hex}">${alpha}</a:srgbClr>`
}

const solidFill = (color: Rgba) => `<a:solidFill>${colorXml(color)}</a:solidFill>`

/** `angle` est déjà dans le repère OOXML : 0° = de gauche à droite, sens horaire. */
function gradFill(from: Rgba, to: Rgba, ooxmlAngle: number): string {
  return '<a:gradFill rotWithShape="1"><a:gsLst>'
    + `<a:gs pos="0">${colorXml(from)}</a:gs><a:gs pos="100000">${colorXml(to)}</a:gs>`
    + `</a:gsLst><a:lin ang="${ang(ooxmlAngle)}" scaled="0"/></a:gradFill>`
}

/** Dégradé d'un bloc. En CSS, 0° pointe vers le haut ; en OOXML, vers la droite. */
function blockGradFill(g: Gradient, opacity: number, svgAngle = false): string {
  return gradFill(
    withOpacity(colorOr(g.from, '#000000'), opacity),
    withOpacity(colorOr(g.to, '#000000'), opacity),
    // Les formes dessinées en SVG tournent un dégradé horizontal (voir
    // ShapeBlock) : leur angle est déjà dans le repère OOXML.
    svgAngle ? g.angle : g.angle - 90,
  )
}

/** Ombre et lueur, les deux seuls effets que PowerPoint sait reproduire. */
function effectLst(fx: BlockEffects | undefined, opacity: number): string {
  if (!fx?.shadow && !fx?.glow) return ''
  let out = ''
  // L'ordre des enfants est imposé par le schéma : lueur avant ombre.
  if (fx.glow) {
    out += `<a:glow rad="${emu(fx.glow.blur * 1.5)}">${colorXml(withOpacity(colorOr(fx.glow.color, '#ffffff'), opacity * 0.7))}</a:glow>`
  }
  if (fx.shadow) {
    const { x, y, blur, color } = fx.shadow
    out += `<a:outerShdw blurRad="${emu(blur)}" dist="${emu(Math.hypot(x, y))}" dir="${ang(Math.atan2(y, x) * 180 / Math.PI)}" algn="ctr" rotWithShape="0">`
      + `${colorXml(withOpacity(colorOr(color, '#000000'), opacity))}</a:outerShdw>`
  }
  return `<a:effectLst>${out}</a:effectLst>`
}

interface Rect { x: number; y: number; w: number; h: number }

function xfrm(rect: Rect, rotation: number | undefined): string {
  const rot = rotation ? ` rot="${ang(rotation)}"` : ''
  return `<a:xfrm${rot}><a:off x="${emu(rect.x)}" y="${emu(rect.y)}"/><a:ext cx="${emu(Math.max(0, rect.w))}" cy="${emu(Math.max(0, rect.h))}"/></a:xfrm>`
}

function roundRectGeom(radius: number, rect: Rect): string {
  const side = Math.min(rect.w, rect.h)
  if (radius <= 0 || side <= 0) return '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'
  const adj = Math.min(50000, Math.round((radius / side) * 100000))
  return `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${adj}"/></a:avLst></a:prstGeom>`
}

/**
 * Tracé libre d'un polygone aux angles arrondis.
 *
 * Même construction que `roundedPolygonPath` (le tracé SVG du rendu) : chaque
 * sommet devient une courbe quadratique qui rentre et ressort le long des deux
 * arêtes. Les coordonnées sont en centièmes de pixel, dans la boîte du bloc.
 */
function polygonGeom(points: Point[], radius: number, width: number, height: number): string {
  const u = (v: number) => Math.round(v * 100)
  const pt = (p: Point) => `<a:pt x="${u(p[0])}" y="${u(p[1])}"/>`
  const n = points.length
  let d = ''

  if (radius <= 0) {
    d = points.map((p, i) => (i === 0 ? `<a:moveTo>${pt(p)}</a:moveTo>` : `<a:lnTo>${pt(p)}</a:lnTo>`)).join('')
  } else {
    for (let i = 0; i < n; i++) {
      const prev = points[(i - 1 + n) % n]
      const curr = points[i]
      const next = points[(i + 1) % n]
      const toPrev = [prev[0] - curr[0], prev[1] - curr[1]]
      const toNext = [next[0] - curr[0], next[1] - curr[1]]
      const lenPrev = Math.hypot(toPrev[0], toPrev[1]) || 1
      const lenNext = Math.hypot(toNext[0], toNext[1]) || 1
      const r = Math.min(radius, lenPrev / 2, lenNext / 2)
      const start: Point = [curr[0] + (toPrev[0] / lenPrev) * r, curr[1] + (toPrev[1] / lenPrev) * r]
      const end: Point = [curr[0] + (toNext[0] / lenNext) * r, curr[1] + (toNext[1] / lenNext) * r]
      d += i === 0 ? `<a:moveTo>${pt(start)}</a:moveTo>` : `<a:lnTo>${pt(start)}</a:lnTo>`
      d += `<a:quadBezTo>${pt(curr)}${pt(end)}</a:quadBezTo>`
    }
  }

  return '<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/>'
    + `<a:pathLst><a:path w="${u(width)}" h="${u(height)}">${d}<a:close/></a:path></a:pathLst></a:custGeom>`
}

// ── Une diapositive en cours d'écriture ──────────────────────────────────────

/** Fichiers `ppt/media/…`, dédoublonnés : une image posée dix fois n'est écrite qu'une fois. */
class MediaBag {
  readonly files = new Map<string, Uint8Array>()
  readonly extensions = new Map<string, string>()
  private readonly byKey = new Map<string, string>()

  add(key: string, bytes: Uint8Array, ext: string): string {
    const known = this.byKey.get(key)
    if (known) return known
    const clean = ext.toLowerCase()
    const name = `media${this.byKey.size + 1}.${clean}`
    this.byKey.set(key, name)
    this.files.set(name, bytes)
    this.extensions.set(clean, CONTENT_TYPES[clean] ?? 'application/octet-stream')
    return name
  }
}

class SlideWriter {
  readonly rels: Relationship[] = [{ id: 'rId1', type: REL.slideLayout, target: '../slideLayouts/slideLayout1.xml' }]
  shapes = ''
  readonly slideNo: number
  private readonly issues: ImportIssue[]
  private nextShapeId = 2

  constructor(slideNo: number, issues: ImportIssue[]) {
    this.slideNo = slideNo
    this.issues = issues
  }

  rel(type: string, target: string, external = false): string {
    const found = this.rels.find(r => r.type === type && r.target === target)
    if (found) return found.id
    const id = `rId${this.rels.length + 1}`
    this.rels.push({ id, type, target, external })
    return id
  }

  id(): number { return this.nextShapeId++ }
  note(message: string) { this.issues.push({ slide: this.slideNo, message }) }
}

// ── Texte ────────────────────────────────────────────────────────────────────

interface TextRunStyle {
  size: number
  bold: boolean
  italic: boolean
  /** Pixels. */
  letterSpacing: number
  fill: string
  /** Contour et effets du texte, déjà en XML. */
  outline: string
  effects: string
}

function runProps(tag: 'rPr' | 'endParaRPr', s: TextRunStyle): string {
  const attrs = `lang="fr-FR" sz="${Math.round(s.size * 100)}" b="${s.bold ? 1 : 0}" i="${s.italic ? 1 : 0}"`
    + (s.letterSpacing ? ` spc="${Math.round(s.letterSpacing * 100)}"` : '')
    + ' dirty="0"'
  // Ordre imposé par le schéma : contour, remplissage, effets, police.
  return `<a:${tag} ${attrs}>${s.outline}${s.fill}${s.effects}<a:latin typeface="${FONT}"/><a:cs typeface="${FONT}"/></a:${tag}>`
}

function paragraphsXml(text: string, align: 'l' | 'ctr' | 'r', lineHeight: number, style: TextRunStyle): string {
  const spacing = `<a:lnSpc><a:spcPct val="${Math.round((lineHeight / SINGLE_LINE) * 100000)}"/></a:lnSpc>`
  return text.replace(/\r\n?/g, '\n').split('\n').map(line => {
    const body = line
      ? `<a:r>${runProps('rPr', style)}<a:t>${esc(line)}</a:t></a:r>`
      // Une ligne vide garde sa hauteur : sans ces propriétés, PowerPoint lui
      // donnerait la taille par défaut (18 pt).
      : runProps('endParaRPr', style)
    return `<a:p><a:pPr algn="${align}">${spacing}</a:pPr>${body}</a:p>`
  }).join('')
}

const ALIGN = { left: 'l', center: 'ctr', right: 'r' } as const
const ANCHOR = { top: 't', middle: 'ctr', bottom: 'b' } as const

function textBox(
  w: SlideWriter, name: string, rect: Rect, rotation: number | undefined,
  insets: { x: number; y: number }, anchor: 't' | 'ctr' | 'b', paragraphs: string,
) {
  w.shapes += '<p:sp>'
    + `<p:nvSpPr><p:cNvPr id="${w.id()}" name="${esc(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>`
    + `<p:spPr>${xfrm(rect, rotation)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>`
    + `<p:txBody><a:bodyPr wrap="square" lIns="${emu(insets.x)}" tIns="${emu(insets.y)}" rIns="${emu(insets.x)}" bIns="${emu(insets.y)}" anchor="${anchor}" rtlCol="0"><a:noAutofit/></a:bodyPr>`
    + `<a:lstStyle/>${paragraphs}</p:txBody></p:sp>`
}

function writeText(w: SlideWriter, block: TextBlockData | TitleBlockData, defaults: ExportDefaults) {
  const opacity = block.opacity ?? 1
  const fx = block.effects
  const size = block.fontSize ?? (block.type === 'title' ? 40 : 18)

  const stroke = fx?.textStroke && fx.textStroke.width > 0
    ? `<a:ln w="${emu(fx.textStroke.width)}">${solidFill(withOpacity(colorOr(fx.textStroke.color, defaults.text), opacity))}</a:ln>`
    : ''

  const style: TextRunStyle = {
    size,
    bold: block.fontWeight === 'bold',
    italic: block.fontStyle === 'italic',
    letterSpacing: block.letterSpacing ?? 0,
    fill: fx?.gradient
      ? blockGradFill(fx.gradient, opacity)
      : solidFill(withOpacity(colorOr(block.color, defaults.text), opacity)),
    outline: stroke,
    effects: effectLst(fx, opacity),
  }

  textBox(
    w, block.type === 'title' ? 'Titre' : 'Texte',
    { x: block.x, y: block.y, w: block.width, h: block.height }, block.rotation,
    { x: PAD_X, y: PAD_Y }, ANCHOR[block.verticalAlign ?? 'top'],
    paragraphsXml(block.content ?? '', ALIGN[block.textAlign ?? 'center'] ?? 'ctr', block.lineHeight ?? 1.4, style),
  )
}

// ── Formes ───────────────────────────────────────────────────────────────────

function writeShape(w: SlideWriter, block: ShapeBlockData, defaults: ExportDefaults): boolean {
  const opacity = block.opacity ?? 1
  const shape = block.shape ?? 'rectangle'
  const border = Math.max(0, block.borderWidth ?? 0)
  const gradient = block.effects?.gradient
  const svg = shape !== 'rectangle' && shape !== 'circle'
  const fill = gradient
    ? blockGradFill(gradient, opacity, svg)
    : solidFill(withOpacity(colorOr(block.backgroundColor, defaults.shapeFill), opacity))
  const strokeFill = solidFill(withOpacity(colorOr(block.borderColor, defaults.text), opacity))
  const outline = border > 0 ? `<a:ln w="${emu(border)}">${strokeFill}<a:round/></a:ln>` : '<a:ln><a:noFill/></a:ln>'
  const head = (name: string) => `<p:nvSpPr><p:cNvPr id="${w.id()}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>`
  const effects = effectLst(block.effects, opacity)

  // La ligne n'a pas de surface : la couleur de fond lui sert de trait et la
  // largeur de bordure d'épaisseur (voir ShapeBlock).
  if (shape === 'line') {
    const thickness = Math.max(2, border || 4)
    const rect = { x: block.x + thickness / 2, y: block.y + block.height / 2, w: block.width - thickness, h: 0 }
    w.shapes += `<p:sp>${head('Ligne')}<p:spPr>${xfrm(rect, block.rotation)}<a:prstGeom prst="line"><a:avLst/></a:prstGeom>`
      + `<a:ln w="${emu(thickness)}" cap="rnd">${fill}<a:round/></a:ln>${effects}</p:spPr></p:sp>`
    return true
  }

  // Le trait PowerPoint est centré sur le contour, alors que la bordure du bloc
  // reste à l'intérieur : on rentre le contour d'une demi-épaisseur.
  const inset = border / 2

  if (shape === 'rectangle' || shape === 'circle') {
    const rect = { x: block.x + inset, y: block.y + inset, w: block.width - border, h: block.height - border }
    const geom = shape === 'circle'
      ? '<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>'
      : roundRectGeom(Math.max(0, (block.borderRadius ?? 4) - inset), rect)
    w.shapes += `<p:sp>${head(shape === 'circle' ? 'Ellipse' : 'Rectangle')}<p:spPr>${xfrm(rect, block.rotation)}${geom}${fill}${outline}${effects}</p:spPr></p:sp>`
    return true
  }

  const inner = { x: inset, y: inset, w: Math.max(1, block.width - border), h: Math.max(1, block.height - border) }
  let points: Point[]
  if (shape === 'grid') {
    const polygon = normalizePolygon(block.customShape)
    if (!polygon || polygon.length < 3) return false
    points = polygon.map(([px, py]) => [inset + px * inner.w, inset + py * inner.h])
  } else {
    points = shapePoints(shape, inner)
  }

  const rect = { x: block.x, y: block.y, w: block.width, h: block.height }
  w.shapes += `<p:sp>${head('Forme')}<p:spPr>${xfrm(rect, block.rotation)}`
    + `${polygonGeom(points, block.borderRadius ?? 0, block.width, block.height)}${fill}${outline}${effects}</p:spPr></p:sp>`
  return true
}

// ── Images ───────────────────────────────────────────────────────────────────

interface PictureOptions {
  name: string
  rect: Rect
  rotation?: number
  opacity: number
  /** Fractions rognées de chaque côté de l'image source (0–1). */
  crop?: { l: number; t: number; r: number; b: number }
  radius?: number
  effects?: string
  link?: string
  video?: string
  descr?: string
}

function writePicture(w: SlideWriter, imageRel: string, o: PictureOptions) {
  const alpha = o.opacity < 1 ? `<a:alphaModFix amt="${pct(o.opacity)}"/>` : ''
  const crop = o.crop && (o.crop.l || o.crop.t || o.crop.r || o.crop.b)
    ? `<a:srcRect l="${pct(o.crop.l)}" t="${pct(o.crop.t)}" r="${pct(o.crop.r)}" b="${pct(o.crop.b)}"/>`
    : ''

  let click = ''
  let media = ''
  if (o.video) {
    // Une vidéo PowerPoint est une image (son affiche) qui porte deux liens vers
    // le fichier : l'un au format historique, l'autre au format 2010.
    const link = w.rel(REL.video, `../media/${o.video}`)
    const embed = w.rel(REL.media, `../media/${o.video}`)
    click = '<a:hlinkClick r:id="" action="ppaction://media"/>'
    media = `<a:videoFile r:link="${link}"/><p:extLst><p:ext uri="{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}">`
      + `<p14:media xmlns:p14="${NS.p14}" r:embed="${embed}"/></p:ext></p:extLst>`
  } else if (o.link) {
    click = `<a:hlinkClick r:id="${w.rel(REL.hyperlink, o.link, true)}" tooltip="${esc(o.link)}"/>`
  }

  const descr = o.descr ? ` descr="${esc(o.descr)}"` : ''
  w.shapes += '<p:pic>'
    + `<p:nvPicPr><p:cNvPr id="${w.id()}" name="${esc(o.name)}"${descr}>${click}</p:cNvPr>`
    + `<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr>${media}</p:nvPr></p:nvPicPr>`
    + `<p:blipFill><a:blip r:embed="${imageRel}">${alpha}</a:blip>${crop}<a:stretch><a:fillRect/></a:stretch></p:blipFill>`
    + `<p:spPr>${xfrm(o.rect, o.rotation)}${roundRectGeom(o.radius ?? 0, o.rect)}${o.effects ?? ''}</p:spPr>`
    + '</p:pic>'
}

async function writeImage(w: SlideWriter, block: ImageBlockData, media: MediaBag, assets: ExportAssets): Promise<boolean> {
  const bytes = await assets.loadMedia(block.src)
  if (!bytes) {
    w.note('Image introuvable dans le projet : ignorée.')
    return false
  }
  const ext = /\.([a-z0-9]+)$/i.exec(block.src)?.[1] ?? 'png'
  const rel = w.rel(REL.image, `../media/${media.add(block.src, bytes, ext)}`)

  let rect: Rect = { x: block.x, y: block.y, w: block.width, h: block.height }
  let crop: PictureOptions['crop']
  const fit = block.objectFit ?? 'cover'
  const size = fit === 'fill' ? undefined : await assets.imageSize(block.src)

  if (size && size.width > 0 && size.height > 0 && rect.w > 0 && rect.h > 0) {
    if (fit === 'cover') {
      // L'image remplit le cadre en gardant ses proportions : ce qui dépasse est
      // rogné à parts égales de chaque côté, comme `object-fit: cover`.
      const scale = Math.max(rect.w / size.width, rect.h / size.height)
      const cutX = (1 - rect.w / (size.width * scale)) / 2
      const cutY = (1 - rect.h / (size.height * scale)) / 2
      crop = { l: cutX, r: cutX, t: cutY, b: cutY }
    } else {
      // `contain` : l'image entière, centrée dans le cadre.
      const scale = Math.min(rect.w / size.width, rect.h / size.height)
      const fw = size.width * scale
      const fh = size.height * scale
      rect = { x: rect.x + (rect.w - fw) / 2, y: rect.y + (rect.h - fh) / 2, w: fw, h: fh }
    }
  }

  writePicture(w, rel, {
    name: 'Image', rect, rotation: block.rotation, opacity: block.opacity ?? 1,
    crop, radius: block.borderRadius, effects: effectLst(block.effects, 1), descr: block.alt,
  })
  return true
}

// ── Fond, numéro, transition ─────────────────────────────────────────────────

function backgroundXml(plan: BackgroundPlan, w: SlideWriter, media: MediaBag, assets: ExportAssets, fallback: Rgba): string {
  let fill: string
  if (plan.kind === 'solid') {
    fill = solidFill({ hex: plan.color.hex, alpha: 1 })
  } else if (plan.kind === 'gradient') {
    fill = gradFill({ ...plan.from, alpha: 1 }, { ...plan.to, alpha: 1 }, plan.angle - 90)
  } else {
    const image = assets.rasters.get(plan.job)
    if (image) {
      const rel = w.rel(REL.image, `../media/${media.add(plan.job, image.bytes, EXT_BY_MIME[image.mimeType])}`)
      fill = `<a:blipFill dpi="0" rotWithShape="1"><a:blip r:embed="${rel}"/><a:srcRect/><a:stretch><a:fillRect/></a:stretch></a:blipFill>`
    } else {
      w.note("Fond non capturé : remplacé par la couleur par défaut.")
      fill = solidFill(fallback)
    }
  }
  return `<p:bg><p:bgPr>${fill}<a:effectLst/></p:bgPr></p:bg>`
}

/** Noir sur fond clair, blanc sur fond sombre — même règle que `readableTextColor`. */
function readableOn(plan: BackgroundPlan): string {
  let l: number | null = null
  if (plan.kind === 'solid') l = luminance(`#${plan.color.hex}`)
  else if (plan.kind === 'gradient') {
    const a = luminance(`#${plan.from.hex}`)
    const b = luminance(`#${plan.to.hex}`)
    l = a !== null && b !== null ? (a + b) / 2 : null
  }
  return l !== null && l > 0.179 ? '#111111' : '#ffffff'
}

function writeNumber(w: SlideWriter, index: number, total: number, numbering: SlideNumbering, background: BackgroundPlan) {
  const text = slideNumberText(index, total, numbering)
  if (!text) return

  const [vertical, horizontal] = numbering.position.split('-') as ['top' | 'bottom', 'left' | 'center' | 'right']
  const size = numbering.size
  const height = size * SINGLE_LINE
  // Mêmes marges que le rendu : 20 px en haut et en bas, 28 px sur les côtés.
  const rect = { x: 0, y: vertical === 'top' ? 20 : 540 - 20 - height, w: 960, h: height }
  const style: TextRunStyle = {
    size,
    bold: numbering.bold,
    italic: false,
    letterSpacing: 0,
    fill: solidFill(withOpacity(colorOr(numbering.color, readableOn(background)), numbering.opacity)),
    outline: '',
    effects: '',
  }

  // Le format simple devient un vrai champ « numéro de diapositive » : il suit
  // si l'on réordonne les diapositives dans PowerPoint. Les autres formats
  // (« 03 », « 3 / 12 », chiffres romains) n'existent pas en champ : texte figé.
  const run = numbering.format === 'n'
    ? `<a:fld id="{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}" type="slidenum">${runProps('rPr', style)}<a:t>${esc(text)}</a:t></a:fld>`
    : `<a:r>${runProps('rPr', style)}<a:t>${esc(text)}</a:t></a:r>`

  textBox(
    w, 'Numéro de diapositive', rect, undefined, { x: 28, y: 0 }, vertical === 'top' ? 't' : 'b',
    `<a:p><a:pPr algn="${ALIGN[horizontal]}"/>${run}</a:p>`,
  )
}

function transitionXml(slide: Slide, ultra: boolean, w: SlideWriter): string {
  const settings = slide.transition
  const def = getSlideTransition(settings?.preset)
  if (!settings || !def || def.id === 'none' || !(ultra || def.tier === 'basic')) return ''

  let effect: string
  switch (def.id) {
    case 'fade': effect = '<p:fade/>'; break
    case 'slide': effect = '<p:push dir="l"/>'; break
    case 'slide-up': effect = '<p:push dir="u"/>'; break
    case 'zoom': effect = '<p:zoom dir="in"/>'; break
    default:
      w.note(`Transition « ${def.label} » sans équivalent PowerPoint : remplacée par un fondu.`)
      effect = '<p:fade/>'
  }
  const speed = settings.speed ?? 1
  const spd = speed >= 1.5 ? 'fast' : speed <= 0.67 ? 'slow' : 'med'
  return `<p:transition spd="${spd}">${effect}</p:transition>`
}

// ── Point d'entrée ───────────────────────────────────────────────────────────

export async function buildPptx(
  slides: Slide[],
  numbering: SlideNumbering,
  plan: ExportPlan,
  options: ExportOptions,
  assets: ExportAssets,
): Promise<{ data: Uint8Array; report: ExportReport }> {
  const { defaults, ultra } = options
  const issues: ImportIssue[] = [...plan.issues]
  const media = new MediaBag()
  const zip = new JSZip()
  const fallbackBg = colorOr(defaults.slideBackground, '#2d2d2d')
  let editableCount = 0
  let imageCount = 0

  for (const [index, slide] of slides.entries()) {
    const slidePlan: SlidePlan = plan.slides[index]
    const w = new SlideWriter(index + 1, issues)
    const background = backgroundXml(slidePlan.background, w, media, assets, fallbackBg)

    for (const { block, plan: blockPlan } of slidePlan.blocks) {
      if (blockPlan.kind === 'native') {
        if (await writeNative(w, block, defaults, media, assets)) editableCount++
        continue
      }

      const image = assets.rasters.get(blockPlan.job)
      if (!image) {
        w.note("Un élément n'a pas pu être capturé : il est absent du fichier.")
        continue
      }
      const rel = w.rel(REL.image, `../media/${media.add(blockPlan.job, image.bytes, EXT_BY_MIME[image.mimeType])}`)

      let video: string | undefined
      if (blockPlan.video) {
        const bytes = await assets.loadMedia(blockPlan.video)
        const ext = /\.([a-z0-9]+)$/i.exec(blockPlan.video)?.[1] ?? 'mp4'
        if (bytes) video = media.add(blockPlan.video, bytes, ext)
        else w.note('Vidéo introuvable dans le projet : seule son image est exportée.')
      }

      const pad = blockPlan.pad
      writePicture(w, rel, {
        name: NAMES[block.type] ?? 'Image',
        rect: { x: block.x - pad, y: block.y - pad, w: block.width + pad * 2, h: block.height + pad * 2 },
        rotation: block.rotation,
        opacity: block.opacity ?? 1,
        link: blockPlan.link,
        video,
        descr: blockPlan.link,
      })
      if (video) editableCount++
      else imageCount++
    }

    writeNumber(w, index, slides.length, numbering, slidePlan.background)

    const xml = `${XML_HEAD}<p:sld ${NS_ATTRS}>`
      + `<p:cSld>${background}<p:spTree>${TREE_HEAD}${w.shapes}</p:spTree></p:cSld>`
      + '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>'
      + transitionXml(slide, ultra, w)
      + '</p:sld>'
    zip.file(`ppt/slides/slide${index + 1}.xml`, xml)
    zip.file(`ppt/slides/_rels/slide${index + 1}.xml.rels`, relsXml(w.rels))
  }

  const count = slides.length
  zip.file('[Content_Types].xml', contentTypesXml(count, media.extensions))
  zip.file('_rels/.rels', rootRelsXml())
  zip.file('docProps/core.xml', corePropsXml(options.title, new Date()))
  zip.file('docProps/app.xml', appPropsXml(count))
  zip.file('ppt/presentation.xml', presentationXml(count, numbering.enabled ? numbering.startAt : 1))
  zip.file('ppt/_rels/presentation.xml.rels', presentationRelsXml(count))
  zip.file('ppt/slideMasters/slideMaster1.xml', slideMasterXml())
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', slideMasterRelsXml())
  zip.file('ppt/slideLayouts/slideLayout1.xml', slideLayoutXml())
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', slideLayoutRelsXml())
  zip.file('ppt/theme/theme1.xml', themeXml())
  // Images et vidéos sont déjà compressées : les recompresser coûte du temps
  // sans rien gagner.
  for (const [name, bytes] of media.files) zip.file(`ppt/media/${name}`, bytes, { compression: 'STORE' })

  const data = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  return { data, report: { slideCount: count, editableCount, imageCount, issues } }
}

const NAMES: Partial<Record<BlockData['type'], string>> = {
  webview: 'Page web',
  carousel: 'Carrousel',
  video: 'Vidéo',
  image: 'Image',
  shape: 'Forme',
  text: 'Texte',
  title: 'Titre',
}

async function writeNative(
  w: SlideWriter, block: BlockData, defaults: ExportDefaults, media: MediaBag, assets: ExportAssets,
): Promise<boolean> {
  switch (block.type) {
    case 'text':
    case 'title':
      writeText(w, block, defaults)
      return true
    case 'shape':
      return writeShape(w, block, defaults)
    case 'image':
      return writeImage(w, block, media, assets)
    default:
      return false
  }
}


