import { normalizeHex } from './color'

/**
 * Palette de couleurs du sélecteur : « récentes » (automatique) et « favoris »
 * (épinglés à la main). Logique pure, sans stockage : voir colorPaletteStore.
 */

export const MAX_RECENT = 12
export const MAX_FAVORITES = 24

export interface Swatches {
  recent: string[]
  favorites: string[]
}

export const EMPTY_SWATCHES: Swatches = { recent: [], favorites: [] }

/** Remet la couleur en tête (sans doublon) et plafonne la liste. Hexa invalide : liste inchangée. */
export function addRecent(list: string[], color: string, max = MAX_RECENT): string[] {
  const hex = normalizeHex(color)
  if (!hex) return list
  return [hex, ...list.filter(c => c !== hex)].slice(0, max)
}

/** Ajoute en fin de liste (les favoris gardent l'ordre choisi) ; sans effet si déjà présent ou plein. */
export function addFavorite(list: string[], color: string, max = MAX_FAVORITES): string[] {
  const hex = normalizeHex(color)
  if (!hex || list.includes(hex) || list.length >= max) return list
  return [...list, hex]
}

export function removeColor(list: string[], color: string): string[] {
  const hex = normalizeHex(color)
  return hex ? list.filter(c => c !== hex) : list
}

/**
 * Lecture tolérante du stockage : JSON cassé, types inattendus, couleurs
 * invalides ou en double sont écartés plutôt que de faire échouer le démarrage.
 */
export function parseSwatches(raw: string | null): Swatches {
  if (!raw) return EMPTY_SWATCHES
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return EMPTY_SWATCHES
    const clean = (value: unknown, max: number): string[] => {
      if (!Array.isArray(value)) return []
      const out: string[] = []
      for (const item of value) {
        const hex = typeof item === 'string' ? normalizeHex(item) : null
        if (hex && !out.includes(hex)) out.push(hex)
      }
      return out.slice(0, max)
    }
    const { recent, favorites } = parsed as Record<string, unknown>
    return { recent: clean(recent, MAX_RECENT), favorites: clean(favorites, MAX_FAVORITES) }
  } catch {
    return EMPTY_SWATCHES
  }
}
