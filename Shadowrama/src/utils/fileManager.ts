import type { BlockData, Slide } from '../types'
import { isKnownBlockType } from '../blocks'
import { registerMedia, getAllMediaForSave, clearMediaStore, pruneMedia } from './mediaStore'
import { nextId } from './ids'

const DRAFT_KEY = 'shadowrama-draft'
const RECENTS_KEY = 'shadowrama-recents'
const MAX_RECENTS = 8

export interface ProjectDraft {
  projectName: string | null
  filePath: string | null
  slides: Slide[]
  savedAt: number
}

export interface RecentProject {
  filePath: string
  name: string
  openedAt: number
}

/** Erreur de lecture d'un projet, avec un message présentable à l'utilisateur. */
export class ProjectFormatError extends Error {}

export function saveDraft(projectName: string | null, filePath: string | null, slides: Slide[]) {
  const draft: ProjectDraft = { projectName, filePath, slides, savedAt: Date.now() }
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    return true
  } catch {
    // Quota dépassé (projet volumineux) ou stockage indisponible : l'échec de
    // l'autosauvegarde ne doit pas faire tomber l'éditeur. Le projet reste
    // intact en mémoire et enregistrable dans un .shma.
    return false
  }
}

export function loadDraft(): ProjectDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const slides = normalizeSlides(parsed?.slides)
    return {
      projectName: typeof parsed.projectName === 'string' ? parsed.projectName : null,
      filePath: typeof parsed.filePath === 'string' ? parsed.filePath : null,
      slides,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
    }
  } catch {
    return null
  }
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
}

// ── Projets récents ─────────────────────────────────────────────────────────

export function loadRecents(): RecentProject[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (r): r is RecentProject => typeof r?.filePath === 'string' && typeof r?.name === 'string'
    )
  } catch {
    return []
  }
}

export function rememberRecent(filePath: string, name: string) {
  try {
    const others = loadRecents().filter(r => r.filePath !== filePath)
    const next = [{ filePath, name, openedAt: Date.now() }, ...others].slice(0, MAX_RECENTS)
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    // Sans historique des récents, l'application reste pleinement utilisable.
  }
}

export function forgetRecent(filePath: string) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(loadRecents().filter(r => r.filePath !== filePath)))
  } catch {
    /* idem */
  }
}

export function projectNameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).pop()!.replace(/\.shma$/i, '')
}

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * Remet des données lues sur disque dans une forme sûre.
 *
 * Un `.shma` peut venir d'une version antérieure, avoir été édité à la main ou
 * être corrompu : plutôt que de faire confiance à `JSON.parse`, on ne garde que
 * ce qui est exploitable et on ignore les blocs d'un type inconnu (au lieu de
 * planter le rendu sur toute la présentation).
 */
function normalizeSlides(raw: unknown): Slide[] {
  if (!Array.isArray(raw)) throw new ProjectFormatError('Le projet ne contient aucune diapositive.')

  const slides: Slide[] = raw.map(slide => {
    const blocks = Array.isArray(slide?.blocks) ? slide.blocks : []
    return {
      id: typeof slide?.id === 'number' ? slide.id : nextId(),
      blocks: blocks.filter(isUsableBlock).map(normalizeBlock),
    }
  })

  return slides.length > 0 ? slides : [{ id: nextId(), blocks: [] }]
}

function isUsableBlock(block: unknown): boolean {
  if (!block || typeof block !== 'object') return false
  const b = block as Record<string, unknown>
  return isKnownBlockType(b.type)
    && typeof b.x === 'number' && typeof b.y === 'number'
    && typeof b.width === 'number' && typeof b.height === 'number'
}

function normalizeBlock(block: BlockData): BlockData {
  // `properties` était autrefois recopié dans chaque bloc puis sérialisé. On le
  // retire à la lecture : les champs éditables viennent désormais de la config
  // du type (voir getBlockProperties), donc un projet ancien profite des champs
  // ajoutés depuis.
  const clean = { ...block } as BlockData & { properties?: unknown }
  delete clean.properties
  if (typeof clean.id !== 'number') clean.id = nextId()
  return clean as BlockData
}

// ── Lecture / écriture ──────────────────────────────────────────────────────

function serializeManifest(slides: Slide[]): string {
  return JSON.stringify({ version: 2, slides })
}

// Médias réellement référencés par un bloc image : tout le reste est du déchet
// laissé par un bloc supprimé ou une image remplacée.
function collectUsedMediaKeys(slides: Slide[]): Set<string> {
  const keys = new Set<string>()
  for (const slide of slides) {
    for (const block of slide.blocks) {
      if (block.type === 'image' && block.src?.startsWith('media/')) keys.add(block.src)
    }
  }
  return keys
}

function mediaToWrite(slides: Slide[]) {
  pruneMedia(collectUsedMediaKeys(slides))
  return getAllMediaForSave()
}

export async function saveProjectAs(slides: Slide[], defaultName: string): Promise<string | null> {
  return window.fileAPI.saveProjectAs(serializeManifest(slides), mediaToWrite(slides), defaultName)
}

export async function saveProjectToPath(slides: Slide[], filePath: string): Promise<string> {
  return window.fileAPI.saveProject(filePath, serializeManifest(slides), mediaToWrite(slides))
}

export async function openProject(): Promise<{ slides: Slide[]; filePath: string } | null> {
  const result = await window.fileAPI.openProject()
  if (!result) return null
  return { slides: readManifest(result.manifestJson, result.media), filePath: result.filePath }
}

/** Ouvre un chemin connu (projets récents), sans boîte de dialogue. */
export async function openProjectAt(filePath: string): Promise<{ slides: Slide[]; filePath: string }> {
  const result = await window.fileAPI.openProjectAt(filePath)
  return { slides: readManifest(result.manifestJson, result.media), filePath: result.filePath }
}

function readManifest(manifestJson: string, media: { key: string; data: string }[]): Slide[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(manifestJson)
  } catch {
    throw new ProjectFormatError("Le fichier est illisible : son contenu n'est pas un projet valide.")
  }

  // v1 : le manifeste était directement le tableau de diapositives.
  const rawSlides = Array.isArray(parsed)
    ? parsed
    : (parsed as { slides?: unknown })?.slides

  const slides = normalizeSlides(rawSlides)

  clearMediaStore()
  for (const m of media) {
    registerMedia(m.key, m.data, guessMimeType(m.key))
  }

  return slides
}

function guessMimeType(filename: string): string {
  if (filename.endsWith('.png')) return 'image/png'
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg'
  if (filename.endsWith('.webp')) return 'image/webp'
  if (filename.endsWith('.gif')) return 'image/gif'
  return 'application/octet-stream'
}
