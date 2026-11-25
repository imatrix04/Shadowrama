import JSZip from 'jszip'
import type { BlockData, Slide } from '../../types'
import { nextId } from '../ids'
import { attr, kid, kids, numAttr, parseXml, path, relAttr } from './xml'
import { loadTheme } from './theme'
import { SLIDE_W, SLIDE_H, MAX_SLIDES, PptxFormatError, Reporter, IDENTITY } from './context'
import type { ImportReport, PptxImportResult, Part, Frame, Ctx } from './context'
import { readText, loadRels, loadPart, relOfType, prepareImages } from './parts'
import type { MediaRegistry } from './parts'
import { walkTree } from './shapes'
import { backgroundOf, transitionOf } from './background'

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

// Types publics de l'import, réexportés pour que le reste de l'application
// n'ait qu'une seule porte d'entrée.
export { PptxFormatError } from './context'
export type { ImportIssue, ImportReport, ImportedMedia, PptxImportResult } from './context'

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
    report.add(null, `Polices du fichier : ${[...report.fonts].join(', ')}. Celles du catalogue sont conservées, les autres remplacées par la plus proche.`)
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
