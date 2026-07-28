import changelogData from '../../changelog.json'

export interface Highlight {
  title: string
  body: string
}

export interface Release {
  version: string
  date: string
  summary?: string
  highlights?: Highlight[]
  added?: string[]
  changed?: string[]
  fixed?: string[]
}

// Embarqué dans le bundle : l'écran « Nouveautés » décrit la version qu'on
// exécute réellement et fonctionne hors ligne, contrairement aux notes lues sur
// GitHub qui, elles, servent à présenter une version pas encore installée.
export const RELEASES: Release[] = (changelogData.releases as Release[]) ?? []

const LAST_SEEN_KEY = 'shadowrama-last-seen-version'

/** Compare deux versions `x.y.z`. Retourne <0, 0 ou >0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

export function getLastSeenVersion(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY)
  } catch {
    return null
  }
}

export function setLastSeenVersion(version: string) {
  try {
    localStorage.setItem(LAST_SEEN_KEY, version)
  } catch {
    // Sans mémorisation, l'écran réapparaîtra : gênant, pas bloquant.
  }
}

/**
 * Versions à présenter après une mise à jour : celles strictement postérieures
 * à la dernière vue, jusqu'à la version installée incluse.
 *
 * Renvoie une liste vide s'il n'y a rien de nouveau à montrer — notamment lors
 * d'une première installation, où accueillir l'utilisateur avec « voici ce qui
 * a changé » n'aurait aucun sens.
 */
export function releasesToAnnounce(currentVersion: string, lastSeen: string | null): Release[] {
  if (!lastSeen) return []
  if (compareVersions(currentVersion, lastSeen) <= 0) return []
  return RELEASES.filter(
    r => compareVersions(r.version, lastSeen) > 0 && compareVersions(r.version, currentVersion) <= 0
  )
}

export function findRelease(version: string): Release | undefined {
  return RELEASES.find(r => r.version === version)
}
