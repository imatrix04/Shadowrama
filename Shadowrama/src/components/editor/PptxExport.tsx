import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { BlockData, Slide, SlideNumbering } from '../../types'
import { BLOCKS_REGISTRY } from '../../blocks'
import { EffectLayer } from '../../ultra/effects'
import { getSlideBackgroundStyle, getSlideParticles } from '../../ultra/slideBackground'
import { getMediaBlob } from '../../utils/mediaStore'
import { recoverAlpha, roundCorners, settle, toJpeg, wait } from '../../utils/pptx/export/capture'
import { FALLBACK_DEFAULTS, planExport } from '../../utils/pptx/export/plan'
import type { CaptureJob, ExportDefaults } from '../../utils/pptx/export/plan'
import { buildPptx } from '../../utils/pptx/export/write'
import type { ExportReport, RasterImage } from '../../utils/pptx/export/write'
import ParticleLayer from './ParticleLayer'
import styles from './PptxExport.module.css'

interface Props {
  slides: Slide[]
  numbering: SlideNumbering
  ultra: boolean
  title: string
  onDone: (report: ExportReport) => void
  onError: (error: unknown) => void
}

const SLIDE_W = 960
const SLIDE_H = 540
/** Hauteur réservée au message d'avancement, hors de la zone photographiée. */
const STATUS_H = 56
const MARGIN = 16
/** Un petit bloc est agrandi avant d'être photographié, pour rester net une
 *  fois étiré dans PowerPoint. */
const MAX_SCALE = 3
const WEBVIEW_TIMEOUT_MS = 12000

interface View {
  job: CaptureJob
  backdrop: string
  /** Page web remplacée par son emplacement inerte (chargement impossible). */
  inert: boolean
  left: number
  top: number
  width: number
  height: number
  scaleX: number
  scaleY: number
}

interface WebviewElement extends HTMLElement {
  isLoading(): boolean
  getWebContentsId(): number
}

/** Couleurs que le rendu tire du thème quand un champ est vide. */
function readDefaults(): ExportDefaults {
  const css = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    slideBackground: read('--slide-bg', FALLBACK_DEFAULTS.slideBackground),
    shapeFill: read('--slide-ink', FALLBACK_DEFAULTS.shapeFill),
    text: read('--slide-ink', FALLBACK_DEFAULTS.text),
  }
}

/** Place la zone photographiée au centre de la fenêtre, à l'échelle la plus grande possible. */
function layout(job: CaptureJob, backdrop: string, inert: boolean): View {
  const contentW = job.block ? job.block.width + job.pad * 2 : SLIDE_W
  const contentH = job.block ? job.block.height + job.pad * 2 : SLIDE_H
  const availW = Math.max(64, window.innerWidth - MARGIN * 2)
  const availH = Math.max(64, window.innerHeight - STATUS_H - MARGIN * 2)
  // La page web est photographiée par son propre processus, à sa taille de
  // mise en page : l'agrandir ici ne lui donnerait pas un pixel de plus.
  const maxScale = job.kind === 'webview' && !inert ? 1 : MAX_SCALE
  const scale = Math.min(availW / contentW, availH / contentH, maxScale)
  const width = Math.max(1, Math.floor(contentW * scale))
  const height = Math.max(1, Math.floor(contentH * scale))
  return {
    job, backdrop, inert, width, height,
    left: Math.floor((window.innerWidth - width) / 2),
    top: Math.floor(MARGIN + (availH - height) / 2),
    // Échelles recalculées sur la taille entière : le contenu remplit la zone
    // au pixel près, sans liseré de fond sur un bord.
    scaleX: width / contentW,
    scaleY: height / contentH,
  }
}

/**
 * Bloc tel qu'il doit être photographié. Opacité et rotation sont retirées :
 * PowerPoint les applique lui-même à l'image, qui reste ainsi réglable. Le mode
 * de fusion l'est aussi — il dépend de ce qu'il y a derrière le bloc, et
 * fausserait la double prise de vue.
 */
function captureBlock(block: BlockData, inert: boolean): BlockData {
  const effects = block.effects ? {
    ...block.effects,
    blendMode: undefined,
    float: undefined,
    // Le flou d'arrière-plan n'a rien à flouter sur une prise de vue isolée.
    glass: block.effects.glass && { ...block.effects.glass, reactive: false },
  } : undefined
  const base = { ...block, effects, opacity: 1, rotation: 0 } as BlockData
  // Sans barre d'adresse : la page occupe tout le bloc, comme l'image exportée.
  if (base.type === 'webview' && !inert) return { ...base, showToolbar: false }
  return base
}

/**
 * Export PowerPoint : photographie ce qui doit devenir une image, puis écrit
 * le fichier.
 *
 * Le composant occupe tout l'écran le temps de l'export. Ce n'est pas un
 * habillage : Electron photographie ce qui est réellement affiché dans la
 * fenêtre, donc chaque élément à capturer doit y être seul, à une position
 * connue. Le plan (voir `planExport`) limite ces prises de vue à ce que
 * PowerPoint ne sait pas représenter — une présentation de texte, de formes et
 * d'images s'exporte sans la moindre capture.
 */
export default function PptxExport({ slides, numbering, ultra, title, onDone, onError }: Props) {
  const [view, setView] = useState<View | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0, writing: false })
  const boxRef = useRef<HTMLDivElement>(null)

  // Le travail est figé au montage : l'éditeur est masqué pendant l'export, et
  // les rappels du parent ne doivent pas le relancer en changeant d'identité.
  const input = useRef({ slides, numbering, ultra, title, onDone, onError })

  useEffect(() => {
    let cancelled = false
    const { slides, numbering, ultra, title, onDone, onError } = input.current

    // Affiche une tâche et attend qu'elle soit peinte. `flushSync` : la suite
    // lit le DOM, il doit être à jour avant de continuer.
    const show = async (next: View, extraMs = 0) => {
      flushSync(() => setView(next))
      const box = boxRef.current
      if (!box) throw new Error("La zone de capture n'est pas montée.")
      await settle(box, extraMs)
      return box
    }

    const shoot = async (box: HTMLElement): Promise<Uint8Array> => {
      const api = window.electronAPI
      if (!api?.captureRect) throw new Error('Capture indisponible hors de l’application de bureau.')
      const rect = box.getBoundingClientRect()
      return api.captureRect({ x: rect.left, y: rect.top, width: rect.width, height: rect.height })
    }

    /** Élément du DOM photographié deux fois, pour retrouver sa transparence. */
    const captureDom = async (job: CaptureJob, inert = false): Promise<RasterImage> => {
      const particles = job.kind === 'background' && !!getSlideParticles(job.background, ultra)
      const onBlack = await shoot(await show(layout(job, '#000000', inert), particles ? 500 : 0))
      // Un fond de diapositive est opaque : une seule prise suffit.
      if (job.kind === 'background') return toJpeg(onBlack)
      const onWhite = await shoot(await show(layout(job, '#ffffff', inert)))
      return recoverAlpha(onBlack, onWhite)
    }

    // Ce que seule la capture peut constater, à ajouter au rapport du plan.
    const notes: { slide: number; message: string }[] = []

    /** Page qui n'a pas pu être chargée : son emplacement inerte la remplace. */
    const placeholder = (job: CaptureJob) => {
      notes.push({ slide: job.slideIndex + 1, message: "Page web injoignable au moment de l'export : remplacée par son emplacement." })
      return captureDom(job, true)
    }

    /** Page web : photographiée dans son propre processus une fois chargée. */
    const captureWebview = async (job: CaptureJob): Promise<RasterImage> => {
      const box = await show(layout(job, '#ffffff', false))
      const webview = box.querySelector<WebviewElement>('webview')
      const api = window.electronAPI
      if (!webview || !api?.captureWebview) return placeholder(job)

      let failed = false
      const onFail = (e: Event) => {
        const ev = e as Event & { errorCode?: number; isMainFrame?: boolean }
        // -3 : navigation interrompue par une autre, pas un échec.
        if (ev.isMainFrame && ev.errorCode !== -3) failed = true
      }
      webview.addEventListener('did-fail-load', onFail)
      try {
        const deadline = performance.now() + WEBVIEW_TIMEOUT_MS
        let loaded = false
        while (!loaded && !failed && !cancelled && performance.now() < deadline) {
          await wait(150)
          // `isLoading` lève tant que la page n'est pas prête à répondre.
          try { loaded = !webview.isLoading() } catch { /* pas encore prête */ }
        }
        if (failed || !loaded) return placeholder(job)
        // Laisse le temps aux images et aux polices de la page d'apparaître.
        await wait(900)
        const png = await api.captureWebview(webview.getWebContentsId())
        const radius = (job.block as { borderRadius?: number }).borderRadius ?? 0
        if (radius <= 0) return toJpeg(png)
        return roundCorners(png, radius / Math.max(1, Math.min(job.block!.width, job.block!.height)))
      } catch {
        return placeholder(job)
      } finally {
        webview.removeEventListener('did-fail-load', onFail)
      }
    }

    const run = async () => {
      const defaults = readDefaults()
      const plan = planExport(slides, ultra, defaults)
      const rasters = new Map<string, RasterImage>()
      setProgress({ done: 0, total: plan.jobs.length, writing: false })

      for (const [index, job] of plan.jobs.entries()) {
        if (cancelled) return
        try {
          rasters.set(job.id, job.kind === 'webview' ? await captureWebview(job) : await captureDom(job))
        } catch (err) {
          // Une capture manquée ne doit pas faire perdre tout l'export : le
          // fichier est écrit sans cet élément, et le rapport le signale.
          console.error('[export pptx] capture impossible', err)
        }
        if (cancelled) return
        setProgress({ done: index + 1, total: plan.jobs.length, writing: false })
      }

      plan.issues.push(...notes)

      flushSync(() => {
        setView(null)
        setProgress(p => ({ ...p, writing: true }))
      })

      const { data, report } = await buildPptx(slides, numbering, plan, { ultra, defaults, title }, {
        rasters,
        loadMedia: async key => {
          const blob = getMediaBlob(key)
          return blob ? new Uint8Array(await blob.arrayBuffer()) : undefined
        },
        imageSize: async key => {
          const blob = getMediaBlob(key)
          if (!blob) return undefined
          try {
            const bitmap = await createImageBitmap(blob)
            const size = { width: bitmap.width, height: bitmap.height }
            bitmap.close()
            return size
          } catch {
            return undefined
          }
        },
      })
      if (cancelled) return
      await window.fileAPI.writePptx(data)
      if (!cancelled) onDone(report)
    }

    // Démarrage différé : en développement, React monte, démonte puis remonte
    // le composant. Le premier passage est annulé avant d'avoir commencé, au
    // lieu de photographier en parallèle du second.
    const timer = setTimeout(() => {
      run().catch(err => { if (!cancelled) onError(err) })
    }, 0)

    // Pendant l'export, l'éditeur est masqué mais toujours monté : ses
    // raccourcis (Suppr, Ctrl+Z…) ne doivent pas agir à l'aveugle.
    const swallow = (e: KeyboardEvent) => {
      e.stopPropagation()
      e.preventDefault()
    }
    window.addEventListener('keydown', swallow, true)

    return () => {
      cancelled = true
      clearTimeout(timer)
      window.removeEventListener('keydown', swallow, true)
    }
  }, [])

  const { done, total, writing } = progress
  const label = writing || total === 0
    ? 'Écriture du fichier PowerPoint…'
    : `Capture des éléments non convertibles… ${Math.min(done + 1, total)} / ${total}`

  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      {view && (
        <div
          ref={boxRef}
          className={styles.box}
          style={{ left: view.left, top: view.top, width: view.width, height: view.height, backgroundColor: view.backdrop }}
        >
          <Content view={view} ultra={ultra} />
        </div>
      )}
      <div className={styles.status}>
        <span>{label}</span>
        {total > 0 && !writing && (
          <span className={styles.bar}>
            <span className={styles.barFill} style={{ display: 'block', width: `${(done / total) * 100}%` }} />
          </span>
        )}
      </div>
    </div>
  )
}

function Content({ view, ultra }: { view: View; ultra: boolean }) {
  const { job, scaleX, scaleY } = view
  const transform = `scale(${scaleX}, ${scaleY})`

  if (job.kind === 'background') {
    const bg = getSlideBackgroundStyle(job.background, ultra)
    return (
      <div
        className={styles.content}
        style={{
          left: 0, top: 0, width: SLIDE_W, height: SLIDE_H, transform,
          overflow: 'hidden', backgroundColor: 'var(--slide-bg)', ...bg.style,
        }}
      >
        <ParticleLayer settings={getSlideParticles(job.background, ultra)} interactive={false} />
      </div>
    )
  }

  const block = captureBlock(job.block!, view.inert)
  const BlockComponent = BLOCKS_REGISTRY[block.type]
  if (!BlockComponent) return null

  return (
    <div
      // La clé ne change pas entre la prise sur noir et celle sur blanc : le
      // bloc n'est pas remonté, les deux captures montrent le même contenu.
      key={`${job.id}-${view.inert ? 'inert' : 'live'}`}
      className={styles.content}
      style={{
        left: job.pad * scaleX, top: job.pad * scaleY,
        width: block.width, height: block.height, transform,
      }}
    >
      <EffectLayer block={block}>
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <BlockComponent
            block={block}
            onUpdate={() => {}}
            isEditing={false}
            // Rendu figé : un carrousel reste sur sa première vue, une vidéo sur
            // son image de départ. Seule une page web a besoin d'être vivante.
            ultra={false}
            mode={block.type === 'webview' && !view.inert ? 'edit' : undefined}
            onStartEdit={() => {}}
            onStopEdit={() => {}}
          />
        </div>
      </EffectLayer>
    </div>
  )
}
