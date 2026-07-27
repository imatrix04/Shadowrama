import type { Slide } from '../types'
import { registerMedia, getAllMediaForSave, clearMediaStore, pruneMedia } from './mediaStore'

const DRAFT_KEY = 'shadowrama-draft'

export interface ProjectDraft {
  projectName: string | null
  filePath: string | null
  slides: Slide[]
  savedAt: number
}

export function saveDraft(projectName: string | null, filePath: string | null, slides: Slide[]) {
  const draft: ProjectDraft = { projectName, filePath, slides, savedAt: Date.now() }
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}

export function loadDraft(): ProjectDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.slides)) return null
    return parsed as ProjectDraft
  } catch {
    return null
  }
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
}

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

  clearMediaStore()
  for (const m of result.media) {
    registerMedia(m.key, m.data, guessMimeType(m.key))
  }

  const parsed = JSON.parse(result.manifestJson)
  const slides: Slide[] = parsed.version && parsed.slides ? parsed.slides : parsed
  return { slides, filePath: result.filePath }
}

function guessMimeType(filename: string): string {
  if (filename.endsWith('.png')) return 'image/png'
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) return 'image/jpeg'
  if (filename.endsWith('.webp')) return 'image/webp'
  if (filename.endsWith('.gif')) return 'image/gif'
  return 'application/octet-stream'
}
