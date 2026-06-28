import type { Slide } from '../types'

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
      saveProjectAs: (json: string, defaultName: string) => Promise<string | null>
      saveProject: (filePath: string, json: string) => Promise<string>
      openProject: () => Promise<{ filePath: string; content: string } | null>
    }
  }
}

function serializeProject(slides: Slide[]): string {
  return JSON.stringify({ version: 1, slides })
}

// Premier save (ou "Enregistrer sous...") : ouvre le dialog, retourne le chemin choisi
export async function saveProjectAs(slides: Slide[], defaultName: string): Promise<string | null> {
  const json = serializeProject(slides)
  return window.fileAPI.saveProjectAs(json, defaultName)
}

// Save suivants : écrase directement, pas de dialog
export async function saveProjectToPath(slides: Slide[], filePath: string): Promise<string> {
  const json = serializeProject(slides)
  return window.fileAPI.saveProject(filePath, json)
}

function parseProjectContent(raw: string): Slide[] {
  const parsed = JSON.parse(raw)
  if (parsed.version && parsed.slides) return parsed.slides
  if (Array.isArray(parsed)) return parsed
  throw new Error('Fichier invalide')
}

export async function openProject(): Promise<{ slides: Slide[]; filePath: string } | null> {
  const result = await window.fileAPI.openProject()
  if (!result) return null
  const slides = parseProjectContent(result.content)
  return { slides, filePath: result.filePath }
}