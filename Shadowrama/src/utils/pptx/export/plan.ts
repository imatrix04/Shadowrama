import type { BlockData, BlockEffects, Slide, SlideBackground } from '../../../types'
import { viewBlock } from '../../../ultra/effectStyle'
import { normalizeWebUrl } from '../../webUrl'
import type { ImportIssue } from '../context'
import { colorOr, mix } from './colors'
import type { Rgba } from './colors'

/**
 * Plan d'export PowerPoint : pour chaque élément, natif ou image ?
 *
 * Principe « éditable d'abord » : tout ce que PowerPoint sait représenter part
 * en objet natif (zone de texte, forme, image, vidéo), modifiable dans
 * PowerPoint. Ce qu'il ne sait pas représenter (page web, carrousel, flou,
 * particules…) est photographié tel qu'il s'affiche et posé comme une image au
 * même endroit — fidèle, mais plus éditable.
 *
 * Ce module ne fait que DÉCIDER. Il est pur : la capture des images vit dans
 * `PptxExport` (elle a besoin de l'écran) et l'écriture du fichier dans `write`.
 * Les deux lisent le même plan, donc ne peuvent pas diverger.
 */

/** Couleurs que le rendu tire du thème de l'application quand un champ est vide. */
export interface ExportDefaults {
  /** Fond d'une diapositive sans réglage (`--editor-bg-canvas`). */
  slideBackground: string
  /** Remplissage d'une forme sans couleur (`--accent`). */
  accent: string
  /** Texte et bordures sans couleur (`--editor-text`). */
  text: string
}

export const FALLBACK_DEFAULTS: ExportDefaults = {
  slideBackground: '#2d2d2d',
  accent: '#6c63ff',
  text: '#ffffff',
}

/** Une image à produire en photographiant le rendu réel. */
export interface CaptureJob {
  id: string
  slideIndex: number
  /**
   * - `block` : le bloc seul, sur fond transparent ;
   * - `webview` : le contenu de la page web du bloc ;
   * - `background` : le fond de la diapositive (image, particules), opaque.
   */
  kind: 'block' | 'webview' | 'background'
  block?: BlockData
  background?: SlideBackground
  /** Marge autour du bloc, en pixels de diapositive, pour ne pas rogner une
   *  ombre ou une lueur qui déborde. */
  pad: number
}

export type BlockPlan =
  | { kind: 'native' }
  | {
      kind: 'raster'
      job: string
      pad: number
      /** Lien ouvert au clic sur l'image (bloc page web). */
      link?: string
      /** Clé média de la vidéo à intégrer : l'image capturée lui sert d'affiche. */
      video?: string
    }

export type BackgroundPlan =
  | { kind: 'solid'; color: Rgba }
  | { kind: 'gradient'; from: Rgba; to: Rgba; angle: number }
  | { kind: 'raster'; job: string }

export interface SlidePlan {
  background: BackgroundPlan
  /** Dans l'ordre d'empilement, du fond vers l'avant. Les blocs sont déjà
   *  filtrés par `viewBlock` : hors mode Ultra, leurs effets sont retirés. */
  blocks: { block: BlockData; plan: BlockPlan }[]
}

export interface ExportPlan {
  slides: SlidePlan[]
  jobs: CaptureJob[]
  issues: ImportIssue[]
}

/** Formats d'image que PowerPoint lit directement. WebP en est absent. */
const NATIVE_IMAGE = /\.(png|jpe?g|gif)$/i
/** Formats vidéo que PowerPoint sait intégrer. */
const NATIVE_VIDEO = /\.(mp4|m4v|mov)$/i

const MAX_PAD = 200

/** Effets sans équivalent PowerPoint : ils imposent de passer par une image. */
function needsRaster(fx: BlockEffects | undefined): boolean {
  if (!fx) return false
  const off = (v: number | undefined) => v !== undefined && v !== 1
  return !!fx.blur || off(fx.brightness) || off(fx.saturate) || off(fx.contrast) || !!fx.corners
}

/** Débord maximal des effets autour du bloc, pour cadrer la capture. */
function effectPad(fx: BlockEffects | undefined): number {
  if (!fx) return 0
  let pad = 0
  if (fx.shadow) pad = Math.max(pad, Math.max(Math.abs(fx.shadow.x), Math.abs(fx.shadow.y)) + fx.shadow.blur * 2)
  // Deux passes de lueur, la seconde au double du rayon (voir effectFilter).
  if (fx.glow) pad = Math.max(pad, fx.glow.blur * 5)
  if (fx.blur) pad += fx.blur * 3
  return Math.min(MAX_PAD, Math.ceil(pad))
}

export function planExport(slides: Slide[], ultra: boolean, defaults: ExportDefaults = FALLBACK_DEFAULTS): ExportPlan {
  const jobs: CaptureJob[] = []
  const issues: ImportIssue[] = []
  const note = (slideNo: number | null, message: string) => { issues.push({ slide: slideNo, message }) }

  const plans = slides.map((slide, slideIndex): SlidePlan => {
    const slideNo = slideIndex + 1
    const addJob = (job: Omit<CaptureJob, 'id' | 'slideIndex'>): string => {
      const id = `s${slideIndex}-${jobs.length}`
      jobs.push({ ...job, id, slideIndex })
      return id
    }

    const background = planBackground(slide.background, ultra, defaults, {
      capture: bg => addJob({ kind: 'background', background: bg, pad: 0 }),
      note: message => note(slideNo, message),
    })

    const ordered = slide.blocks
      .map(block => viewBlock(block, ultra))
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))

    const blocks: SlidePlan['blocks'] = []
    let animated = false

    for (const block of ordered) {
      if (block.motion?.in || block.motion?.out || (block.animation && block.animation.type !== 'none') || block.effects?.float) {
        animated = true
      }
      const blend = block.effects?.blendMode
      if (blend && blend !== 'normal') note(slideNo, 'Mode de fusion sans équivalent PowerPoint : ignoré.')

      const raster = (extra: { link?: string; video?: string } = {}, kind: CaptureJob['kind'] = 'block') => {
        const pad = kind === 'webview' ? 0 : effectPad(block.effects)
        blocks.push({ block, plan: { kind: 'raster', job: addJob({ kind, block, pad }), pad, ...extra } })
      }
      const fxRaster = needsRaster(block.effects)
      if (fxRaster) note(slideNo, 'Effet avancé (flou, réglages de couleur, coins…) : élément exporté en image.')

      switch (block.type) {
        case 'text':
        case 'title':
          if (fxRaster) raster()
          else blocks.push({ block, plan: { kind: 'native' } })
          break

        case 'shape':
          if (fxRaster) raster()
          else blocks.push({ block, plan: { kind: 'native' } })
          break

        case 'image': {
          if (!block.src) break
          const native = block.src.startsWith('media/') && NATIVE_IMAGE.test(block.src)
            && block.shapeMode !== 'grid'
            // Un arrondi sur une image « contenue » arrondit le cadre, pas
            // l'image : PowerPoint ne sait arrondir que l'image elle-même.
            && !((block.objectFit ?? 'cover') === 'contain' && (block.borderRadius ?? 0) > 0)
            && !fxRaster
          if (native) blocks.push({ block, plan: { kind: 'native' } })
          else raster()
          break
        }

        case 'carousel':
          if (!block.items?.length) break
          note(slideNo, 'Carrousel : seule la première vue est exportée, en image.')
          raster()
          break

        case 'video':
          if (!block.src) break
          if (NATIVE_VIDEO.test(block.src)) {
            raster({ video: block.src })
          } else {
            note(slideNo, 'Vidéo dans un format que PowerPoint ne lit pas : exportée en image fixe.')
            raster()
          }
          break

        case 'webview': {
          const url = normalizeWebUrl(block.url)
          if (!url) break
          note(slideNo, 'Page web : exportée en image cliquable, qui ouvre le site.')
          raster({ link: url }, 'webview')
          break
        }
      }
    }

    if (animated) note(slideNo, 'Animations des éléments non exportées.')
    return { background, blocks }
  })

  return { slides: plans, jobs, issues }
}

function planBackground(
  background: SlideBackground | undefined,
  ultra: boolean,
  defaults: ExportDefaults,
  hooks: { capture: (background: SlideBackground) => string; note: (message: string) => void },
): BackgroundPlan {
  const fallback: BackgroundPlan = { kind: 'solid', color: colorOr(defaults.slideBackground, FALLBACK_DEFAULTS.slideBackground) }
  if (!background) return fallback

  // Même règle que le rendu (getSlideBackgroundStyle / getSlideParticles) : hors
  // mode Ultra, seule la couleur unie a un effet.
  const particles = ultra && !!background.particles?.enabled && background.particles.count > 0
  if (particles) {
    hooks.note('Particules animées : figées dans une image de fond.')
    return { kind: 'raster', job: hooks.capture(background) }
  }

  if (background.type === 'color') {
    return background.color ? { kind: 'solid', color: colorOr(background.color, defaults.slideBackground) } : fallback
  }
  if (!ultra) return fallback

  if (background.type === 'gradient' && background.gradient) {
    if (background.animated) hooks.note('Dégradé animé : exporté fixe.')
    let from = colorOr(background.gradient.from, '#000000')
    let to = colorOr(background.gradient.to, '#000000')
    // Le voile uni par-dessus un dégradé reste un dégradé : on le fond dans
    // les deux couleurs plutôt que de passer par une image.
    const overlay = background.overlay
    if (overlay && overlay.opacity > 0) {
      const veil = colorOr(overlay.color, '#000000')
      from = mix(from, veil, overlay.opacity)
      to = mix(to, veil, overlay.opacity)
    }
    return { kind: 'gradient', from, to, angle: background.gradient.angle }
  }

  if (background.type === 'image' && background.image) {
    return { kind: 'raster', job: hooks.capture(background) }
  }

  return fallback
}
