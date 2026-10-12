import type { ImportIssue } from './import'

export interface IssueGroup {
  message: string
  /** Diapositives concernées, triées, sans doublon. Vide = remarque globale. */
  slides: number[]
}

/**
 * Regroupe les remarques d'import par message.
 *
 * Un gros fichier produit la même remarque (« image recadrée »…) sur des dizaines
 * de diapositives : les lister une à une noie l'information utile. Chaque message
 * n'apparaît plus qu'une fois, suivi des diapositives qu'il concerne. L'ordre
 * d'apparition est conservé.
 */
export function groupImportIssues(issues: ImportIssue[]): IssueGroup[] {
  const groups = new Map<string, Set<number>>()
  for (const issue of issues) {
    let slides = groups.get(issue.message)
    if (!slides) groups.set(issue.message, slides = new Set())
    if (issue.slide !== null) slides.add(issue.slide)
  }
  return [...groups].map(([message, slides]) => ({
    message,
    slides: [...slides].sort((a, b) => a - b),
  }))
}

/** « 1-3, 5, 8-9 » : les suites consécutives sont abrégées. */
export function formatSlideRanges(slides: number[]): string {
  const parts: string[] = []
  let i = 0
  while (i < slides.length) {
    let j = i
    while (j + 1 < slides.length && slides[j + 1] === slides[j] + 1) j++
    parts.push(j - i >= 1 ? `${slides[i]}-${slides[j]}` : String(slides[i]))
    i = j + 1
  }
  return parts.join(', ')
}