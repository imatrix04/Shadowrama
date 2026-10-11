import type { VideoBlockData } from '../types'

/**
 * Taille maximale d'une vidéo importée. Le média reste en mémoire (octets bruts
 * + URL de lecture) et traverse l'IPC à chaque enregistrement : au-delà, la
 * sauvegarde devient lente et l'éditeur gourmand.
 */
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024

export const VIDEO_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]

/** Clé média d'une vidéo (voir generateMediaKey). */
export function isVideoKey(key: string): boolean {
  return /^media\/vid-/.test(key)
}

/**
 * Une vidéo ne se lit que depuis le projet : une clé `media/…` ou rien. Un
 * `.shma` venu de l'extérieur ne doit pas pouvoir pointer vers `file:` ou une
 * adresse distante.
 */
export function sanitizeVideoSrc(value: unknown): string {
  return typeof value === 'string' && value.startsWith('media/') ? value : ''
}

function finite(value: unknown): number | undefined {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined
}

export interface VideoPlayback {
  autoplay: boolean
  loop: boolean
  muted: boolean
  volume: number
  showControls: boolean
  playbackRate: number
  startTime: number
  /** 0 = jusqu'à la fin du fichier. */
  endTime: number
}

/**
 * Réglages de lecture avec leurs valeurs par défaut, bornés. Source unique pour
 * le composant et la validation du fichier : un projet ancien, édité à la main
 * ou venant d'un menu (qui rend des chaînes) donne toujours des valeurs saines.
 */
export function resolvePlayback(block: Partial<VideoBlockData>): VideoPlayback {
  const startTime = Math.max(0, finite(block.startTime) ?? 0)
  const rawEnd = Math.max(0, finite(block.endTime) ?? 0)
  return {
    autoplay: block.autoplay ?? true,
    loop: block.loop ?? false,
    muted: block.muted ?? false,
    volume: Math.min(1, Math.max(0, finite(block.volume) ?? 1)),
    showControls: block.showControls ?? false,
    playbackRate: Math.min(4, Math.max(0.25, finite(block.playbackRate) ?? 1)),
    startTime,
    // Une fin avant le début n'a pas de sens : on lit jusqu'au bout.
    endTime: rawEnd > startTime ? rawEnd : 0,
  }
}

/** Remet les champs numériques d'un bloc vidéo lu sur disque dans une forme saine. */
export function normalizeVideoBlock<T extends Partial<VideoBlockData>>(block: T): T {
  const out: Record<string, unknown> = { ...block, src: sanitizeVideoSrc(block.src) }
  for (const key of ['volume', 'playbackRate', 'startTime', 'endTime'] as const) {
    if (key in out) {
      const n = finite(out[key])
      if (n === undefined) delete out[key]
      else out[key] = n
    }
  }
  for (const key of ['autoplay', 'loop', 'muted', 'showControls'] as const) {
    if (key in out && typeof out[key] !== 'boolean') delete out[key]
  }
  return out as T
}

/**
 * Hauteur qui respecte le rapport largeur/hauteur d'une vidéo, pour une largeur
 * donnée. Évite des bandes noires (ou un rognage) dès l'import.
 */
export function heightForRatio(width: number, videoWidth: number, videoHeight: number): number | undefined {
  if (!(videoWidth > 0) || !(videoHeight > 0) || !(width > 0)) return undefined
  return Math.max(40, Math.round((width * videoHeight) / videoWidth))
}

/** Dimensions d'une vidéo, lues dans ses métadonnées. `null` si illisible. */
export function readVideoSize(url: string, timeoutMs = 4000): Promise<{ width: number; height: number } | null> {
  return new Promise(resolve => {
    const el = document.createElement('video')
    let done = false
    const finish = (size: { width: number; height: number } | null) => {
      if (done) return
      done = true
      clearTimeout(timer)
      el.removeAttribute('src')
      el.load()
      resolve(size)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    el.preload = 'metadata'
    el.muted = true
    el.onloadedmetadata = () => finish({ width: el.videoWidth, height: el.videoHeight })
    el.onerror = () => finish(null)
    el.src = url
  })
}