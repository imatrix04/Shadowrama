import type { Slide } from '../types'
import { registerMedia, getAllMediaForSave, clearMediaStore } from './mediaStore'

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

declare global {
  interface Window {
    fileAPI: {
      saveProjectAs: (manifestJson: string, media: { key: string; data: string }[], defaultName: string) => Promise<string | null>
      saveProject: (filePath: string, manifestJson: string, media: { key: string; data: string }[]) => Promise<string>
      openProject: () => Promise<{ filePath: string; manifestJson: string; media: { key: string; data: string }[] } | null>
    }
  }
}

function serializeManifest(slides: Slide[]): string {
  return JSON.stringify({ version: 2, slides })
}

export async function saveProjectAs(slides: Slide[], defaultName: string): Promise<string | null> {
  const manifestJson = serializeManifest(slides)
  const media = getAllMediaForSave()
  return window.fileAPI.saveProjectAs(manifestJson, media, defaultName)
}

export async function saveProjectToPath(slides: Slide[], filePath: string): Promise<string> {
  const manifestJson = serializeManifest(slides)
  const media = getAllMediaForSave()
  return window.fileAPI.saveProject(filePath, manifestJson, media)
}

export async function openProject(): Promise<{ slides: Slide[]; filePath: string } | null> {
  const result = await window.fileAPI.openProject()
  if (!result) return null

  clearMediaStore()
  for (const m of result.media) {
    const mimeType = guessMimeType(m.key)
    registerMedia(m.key, m.data, mimeType)
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