import type { BlockData, ImageBlockData, ShapeBlockData } from '../../types'
import { nextId } from '../ids'
import { attr, descendants, kid, kids, numAttr, path, relAttr } from './xml'
import { r1, readXfrm, toBox } from './context'
import type { Part, Tx, Ctx, Xfrm, Box } from './context'
import { readPh, findPlaceholder } from './parts'
import { resolveShapeFill, resolveStroke } from './fills'
import { readAdjust, presetSpec, custGeomToPolygon } from './geometry'
import type { ShapeSpec } from './geometry'
import { emitText } from './text'
import { emitTable } from './table'

/**
 * Formes, images et groupes : parcours de l'arbre d'une diapositive.
 */

// ── Formes, images, groupes ──────────────────────────────────────────────────

export function emitLine(
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

export function emitShape(sp: Element, ctx: Ctx, tx: Tx, blocks: BlockData[]) {
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

export function emitPicture(pic: Element, part: Part, ctx: Ctx, tx: Tx, blocks: BlockData[]) {
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

export function walkTree(tree: Element, part: Part, ctx: Ctx, tx: Tx, blocks: BlockData[]) {
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
        // Un tableau natif devient un bloc tableau ; le reste est signalé ci-dessous.
        if (!ctx.decorOnly && emitTable(node, ctx, tx, blocks)) break
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
