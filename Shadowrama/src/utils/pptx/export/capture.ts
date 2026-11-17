import type { RasterImage } from './write'

/**
 * Traitement des captures d'écran de l'export PowerPoint.
 *
 * Electron photographie une zone de la fenêtre : le résultat est toujours
 * opaque. Or un bloc exporté en image doit garder sa transparence — une ombre,
 * une lueur, un coin arrondi ne doivent pas emporter un rectangle de fond avec
 * eux. D'où la double prise de vue (voir `recoverAlpha`).
 */

async function decode(png: Uint8Array): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
  const bitmap = await createImageBitmap(new Blob([png.slice()], { type: 'image/png' }))
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas indisponible.')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return { canvas, ctx }
}

async function encode(canvas: HTMLCanvasElement, mimeType: RasterImage['mimeType'], quality?: number): Promise<RasterImage> {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mimeType, quality))
  if (!blob) throw new Error("L'image n'a pas pu être encodée.")
  return { bytes: new Uint8Array(await blob.arrayBuffer()), mimeType }
}

/**
 * Retrouve la transparence à partir de deux captures du même contenu, l'une
 * sur fond noir, l'autre sur fond blanc.
 *
 * Un pixel de couleur C et d'opacité a donne `a·C` sur noir et `a·C + (1 − a)`
 * sur blanc : l'écart entre les deux vaut `1 − a`, quel que soit le contenu.
 * On en tire l'opacité, puis la couleur d'origine en divisant la version sur
 * noir par cette opacité. Exact pour tout ce que le navigateur sait dessiner —
 * flous, ombres et dégradés compris.
 */
export async function recoverAlpha(onBlack: Uint8Array, onWhite: Uint8Array): Promise<RasterImage> {
  const black = await decode(onBlack)
  const white = await decode(onWhite)
  const { width, height } = black.canvas
  if (white.canvas.width !== width || white.canvas.height !== height) {
    throw new Error('Les deux captures ne se superposent pas.')
  }

  const image = black.ctx.getImageData(0, 0, width, height)
  const b = image.data
  const w = white.ctx.getImageData(0, 0, width, height).data

  for (let i = 0; i < b.length; i += 4) {
    // Moyenne des trois canaux : atténue le bruit d'arrondi d'un canal isolé.
    const gap = (w[i] - b[i] + w[i + 1] - b[i + 1] + w[i + 2] - b[i + 2]) / 3
    const alpha = Math.min(255, Math.max(0, 255 - gap))
    if (alpha < 1) {
      b[i] = b[i + 1] = b[i + 2] = b[i + 3] = 0
      continue
    }
    const k = 255 / alpha
    b[i] = Math.min(255, b[i] * k)
    b[i + 1] = Math.min(255, b[i + 1] * k)
    b[i + 2] = Math.min(255, b[i + 2] * k)
    b[i + 3] = alpha
  }

  black.ctx.putImageData(image, 0, 0)
  return encode(black.canvas, 'image/png')
}

/** Capture opaque (fond de diapositive) : le JPEG pèse bien moins qu'un PNG. */
export async function toJpeg(png: Uint8Array): Promise<RasterImage> {
  const { canvas } = await decode(png)
  return encode(canvas, 'image/jpeg', 0.92)
}

/**
 * Arrondit les coins d'une capture opaque (page web).
 * `radiusRatio` : rayon rapporté au petit côté, comme l'arrondi du bloc.
 */
export async function roundCorners(png: Uint8Array, radiusRatio: number): Promise<RasterImage> {
  const source = await decode(png)
  const { width, height } = source.canvas
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponible.')
  ctx.beginPath()
  ctx.roundRect(0, 0, width, height, Math.min(0.5, Math.max(0, radiusRatio)) * Math.min(width, height))
  ctx.clip()
  ctx.drawImage(source.canvas, 0, 0)
  return encode(out, 'image/png')
}

const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
export const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * Attend que le contenu soit réellement peint : polices chargées, images
 * décodées, vidéos calées sur leur image. Une capture prise trop tôt montrerait
 * un cadre vide.
 */
export async function settle(root: HTMLElement, extraMs = 0): Promise<void> {
  await document.fonts?.ready
  await Promise.all(Array.from(root.querySelectorAll('img')).map(img =>
    (img.complete && img.naturalWidth > 0 ? Promise.resolve() : img.decode()).catch(() => {})))

  const videos = Array.from(root.querySelectorAll('video'))
  const deadline = performance.now() + 5000
  while (videos.some(v => !v.error && (v.readyState < 2 || v.seeking)) && performance.now() < deadline) {
    await wait(50)
  }

  // Deux images : la première applique le rendu, la seconde garantit qu'il a
  // atteint l'écran avant que le processus principal ne le photographie.
  await frame()
  await frame()
  await wait(60 + extraMs)
}
