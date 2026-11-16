import type JSZip from 'jszip'
import { attr, kids, parseXml, path } from './xml'
import { MAX_MEDIA_BYTES, Reporter } from './context'
import type { ImportedMedia, Rel, Part } from './context'

/**
 * Lecture des parties du .pptx : fichiers du zip, relations entre parties,
 * placeholders hérités du masque et de la mise en page, images.
 */

// ── Parties du zip ───────────────────────────────────────────────────────────

export function resolveTarget(basePath: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  const parts = basePath.split('/').slice(0, -1)
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop()
    else if (seg !== '.' && seg !== '') parts.push(seg)
  }
  return parts.join('/')
}

export async function readText(zip: JSZip, filePath: string): Promise<string | null> {
  const file = zip.file(filePath)
  return file ? file.async('string') : null
}

export async function loadRels(zip: JSZip, partPath: string): Promise<Map<string, Rel>> {
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

export async function loadPart(zip: JSZip, partPath: string): Promise<Part | null> {
  const text = await readText(zip, partPath)
  if (!text) return null
  try {
    return { path: partPath, root: parseXml(text), rels: await loadRels(zip, partPath), images: new Map() }
  } catch {
    return null
  }
}

export function relOfType(part: Part | null, suffix: string): Rel | undefined {
  if (!part) return undefined
  for (const rel of part.rels.values()) {
    if (rel.type.endsWith(suffix)) return rel
  }
  return undefined
}

// ── Placeholders ─────────────────────────────────────────────────────────────

export interface PhInfo {
  type?: string
  idx?: string
}

export function readPh(sp: Element): PhInfo | null {
  const ph = path(sp, 'nvSpPr', 'nvPr', 'ph') ?? path(sp, 'nvPicPr', 'nvPr', 'ph')
  if (!ph) return null
  return { type: attr(ph, 'type'), idx: attr(ph, 'idx') }
}

export function normalizePhType(type: string | undefined): string {
  if (!type) return 'body'
  if (type === 'ctrTitle') return 'title'
  if (type === 'subTitle' || type === 'obj') return 'body'
  return type
}

export function findPlaceholder(part: Part | null, ph: PhInfo): Element | null {
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

// ── Médias ───────────────────────────────────────────────────────────────────

export const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
}

export interface MediaRegistry {
  byPath: Map<string, string | null>
  list: ImportedMedia[]
}

export async function prepareImages(zip: JSZip, part: Part | null, registry: MediaRegistry, report: Reporter, slideNo: number) {
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
