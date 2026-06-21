import type { Slide } from '../types'

const DRAFT_KEY = 'shadowrama-draft'

export interface ProjectDraft {
  projectName: string | null
  slides: Slide[]
  savedAt: number
}

export function saveDraft(projectName: string | null, slides: Slide[]) {
  const draft: ProjectDraft = { projectName, slides, savedAt: Date.now() }
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

export function saveProject(slides: Slide[], name: string) {
  const payload = {
    version: 1,
    slides,
  }
  const json = JSON.stringify(payload)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.shma`
  a.click()
  URL.revokeObjectURL(url)
}

export function loadProject(file: File): Promise<Slide[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string)
        // Format nouveau { version, slides }
        if (parsed.version && parsed.slides) {
          resolve(parsed.slides)
        }
        // Format ancien (tableau direct)
        else if (Array.isArray(parsed)) {
          resolve(parsed)
        }
        else {
          reject(new Error('Fichier invalide'))
        }
      } catch {
        reject(new Error('Fichier corrompu'))
      }
    }
    reader.readAsText(file)
  })
}