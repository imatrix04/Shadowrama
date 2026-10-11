import type { BlockData } from '../types'

/**
 * Clés média (`media/…`) référencées par un bloc.
 *
 * Source unique pour l'enregistrement du projet (rien d'orphelin dans le .shma)
 * et pour le presse-papiers (couper puis enregistrer ne doit pas purger le
 * média) : un nouveau bloc à média ne s'ajoute qu'ici.
 */
export function blockMediaKeys(block: BlockData): string[] {
  const keys: string[] = []
  const add = (src: unknown) => {
    if (typeof src === 'string' && src.startsWith('media/')) keys.push(src)
  }
  switch (block.type) {
    case 'image':
    case 'video':
      add(block.src)
      break
    case 'carousel':
      for (const item of block.items ?? []) add(item.src)
      break
  }
  return keys
}