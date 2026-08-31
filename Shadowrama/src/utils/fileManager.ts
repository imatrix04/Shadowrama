import type { BlockData, Slide, SlideBackground, SlideTransitionSettings } from '../types'
import { isKnownBlockType } from '../blocks'
import { registerMedia, getAllMediaForSave, clearMediaStore } from './mediaStore'
import { clipboardMediaKeys } from './clipboard'
import { nextId } from './ids'
import { DRAFT_STORE, withStore } from './idb'

/** Ancien emplacement du brouillon (localStorage), conservé pour la reprise. */
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

/**
 * Le brouillon vit dans IndexedDB, plus dans localStorage.
 *
 * localStorage plafonne à quelques mégaoctets — qu'un projet illustré atteint
 * vite — et son écriture est synchrone : sérialiser toutes les diapositives
 * toutes les 500 ms bloquait le thread principal pendant la frappe. IndexedDB
 * n'impose ni ce plafond, ni ce blocage, et stocke les objets tels quels : plus
 * de `JSON.stringify` sur l'ensemble du projet à chaque autosauvegarde.
 */
const DRAFT_ID = 'current'

interface StoredDraft extends ProjectDraft {
  id: string
}

export async function saveDraft(
  projectName: string | null,
  filePath: string | null,
  slides: Slide[],
): Promise<boolean> {
  const draft: StoredDraft = { id: DRAFT_ID, projectName, filePath, slides, savedAt: Date.now() }
  try {
    await withStore(DRAFT_STORE, 'readwrite', s => s.put(draft))
    return true
  } catch {
    // Stockage indisponible ou refusé : l'échec de l'autosauvegarde ne doit pas
    // faire tomber l'éditeur. Le projet reste intact en mémoire et
    // enregistrable dans un .shma.
    return false
  }
}

export async function loadDraft(): Promise<ProjectDraft | null> {
  try {
    const stored = await withStore<StoredDraft | undefined>(
      DRAFT_STORE, 'readonly', s => s.get(DRAFT_ID) as IDBRequest<StoredDraft | undefined>,
    )
    if (stored) return parseDraft(stored)
  } catch {
    // On tente quand même la reprise depuis l'ancien emplacement.
  }
  return loadLegacyDraft()
}

/**
 * Brouillon laissé par une version antérieure dans localStorage.
 *
 * Sans cette reprise, la mise à jour ferait perdre le travail en cours à
 * quiconque avait l'éditeur ouvert sans avoir enregistré de `.shma`.
 */
function loadLegacyDraft(): ProjectDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    return parseDraft(JSON.parse(raw))
  } catch {
    return null
  }
}

function parseDraft(parsed: unknown): ProjectDraft | null {
  try {
    const draft = parsed as Partial<ProjectDraft>
    return {
      projectName: typeof draft.projectName === 'string' ? draft.projectName : null,
      filePath: typeof draft.filePath === 'string' ? draft.filePath : null,
      slides: normalizeSlides(draft.slides),
      savedAt: typeof draft.savedAt === 'number' ? draft.savedAt : Date.now(),
    }
  } catch {
    return null
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await withStore(DRAFT_STORE, 'readwrite', s => s.delete(DRAFT_ID))
  } catch {
    /* rien à nettoyer si le stockage est indisponible */
  }
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* idem */
  }
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
    const normalized: Slide = {
      id: typeof slide?.id === 'number' ? slide.id : nextId(),
      blocks: blocks.filter(isUsableBlock).map(normalizeBlock),
    }
    const transition = normalizeTransition((slide as { transition?: unknown })?.transition)
    if (transition) normalized.transition = transition
    const background = normalizeBackground((slide as { background?: unknown })?.background)
    if (background) normalized.background = background
    return normalized
  })

  return slides.length > 0 ? slides : [{ id: nextId(), blocks: [] }]
}

function normalizeTransition(raw: unknown): SlideTransitionSettings | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const t = raw as Record<string, unknown>
  if (typeof t.preset !== 'string') return undefined
  return {
    preset: t.preset,
    speed: typeof t.speed === 'number' ? t.speed : undefined,
  }
}

/** Même logique de tri que `normalizeBlock` : on ne garde que des champs bien
 *  formés, un `.shma` corrompu ou édité à la main ne doit pas faire planter
 *  le rendu du fond. */
function normalizeBackground(raw: unknown): SlideBackground | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const b = raw as Record<string, unknown>
  if (b.type !== 'color' && b.type !== 'gradient' && b.type !== 'image') return undefined

  const background: SlideBackground = { type: b.type }

  if (typeof b.color === 'string') background.color = b.color

  if (b.gradient && typeof b.gradient === 'object') {
    const g = b.gradient as Record<string, unknown>
    if (typeof g.from === 'string' && typeof g.to === 'string' && typeof g.angle === 'number') {
      background.gradient = { from: g.from, to: g.to, angle: g.angle }
    }
  }

  if (typeof b.animated === 'boolean') background.animated = b.animated
  if (typeof b.image === 'string') background.image = b.image
  if (b.imageFit === 'cover' || b.imageFit === 'contain') background.imageFit = b.imageFit

  if (b.overlay && typeof b.overlay === 'object') {
    const o = b.overlay as Record<string, unknown>
    if (typeof o.color === 'string' && typeof o.opacity === 'number') {
      background.overlay = { color: o.color, opacity: o.opacity }
    }
  }

  return background
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
// laissé par un bloc supprimé ou une image remplacée. Le presse-papiers compte
// comme une référence, sinon couper une image puis enregistrer avant de coller
// la ferait disparaître.
function collectUsedMediaKeys(slides: Slide[]): Set<string> {
  const keys = new Set<string>(clipboardMediaKeys())
  for (const slide of slides) {
    for (const block of slide.blocks) {
      if (block.type === 'image' && block.src?.startsWith('media/')) keys.add(block.src)
    }
    if (slide.background?.type === 'image' && slide.background.image?.startsWith('media/')) {
      keys.add(slide.background.image)
    }
  }
  return keys
}

function mediaToWrite(slides: Slide[]) {
  return getAllMediaForSave(collectUsedMediaKeys(slides))
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

/**
 * Partie purement décisionnelle de la lecture d'un projet : du texte vers des
 * diapositives valides, sans toucher au store média. Exportée pour être testable
 * seule — c'est le point d'entrée de toute donnée venue du disque.
 */
export function parseManifestSlides(manifestJson: string): Slide[] {
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

  return normalizeSlides(rawSlides)
}

function readManifest(manifestJson: string, media: { key: string; data: Uint8Array }[]): Slide[] {
  const slides = parseManifestSlides(manifestJson)

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