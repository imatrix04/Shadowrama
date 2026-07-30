import type { BlockData, BlockEffects, Gradient } from '../types'

/**
 * Chaîne `filter` CSS correspondant aux effets.
 *
 * `drop-shadow` est préféré à `box-shadow` : il suit la silhouette réelle du
 * bloc, donc l'ombre d'un triangle ou d'une étoile épouse la forme au lieu de
 * dessiner un rectangle.
 */
export function effectFilter(fx: BlockEffects): string | undefined {
  const parts: string[] = []

  if (fx.shadow) {
    const { x, y, blur, color } = fx.shadow
    parts.push(`drop-shadow(${x}px ${y}px ${blur}px ${color})`)
  }
  if (fx.glow) {
    // Deux passes : une lueur simple est trop discrète pour se voir.
    parts.push(`drop-shadow(0 0 ${fx.glow.blur}px ${fx.glow.color})`)
    parts.push(`drop-shadow(0 0 ${fx.glow.blur * 2}px ${fx.glow.color})`)
  }
  if (fx.blur) parts.push(`blur(${fx.blur}px)`)
  if (fx.brightness !== undefined && fx.brightness !== 1) parts.push(`brightness(${fx.brightness})`)
  if (fx.saturate !== undefined && fx.saturate !== 1) parts.push(`saturate(${fx.saturate})`)
  if (fx.contrast !== undefined && fx.contrast !== 1) parts.push(`contrast(${fx.contrast})`)

  return parts.length > 0 ? parts.join(' ') : undefined
}

export function cornerRadius(fx: BlockEffects): string | undefined {
  if (!fx.corners) return undefined
  const { tl, tr, br, bl } = fx.corners
  return `${tl}px ${tr}px ${br}px ${bl}px`
}

export function gradientCss(g: Gradient): string {
  return `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})`
}

/** Le bloc porte-t-il un dégradé exploitable par son rendu ? */
export function blockGradient(block: BlockData): Gradient | undefined {
  return block.effects?.gradient
}


/**
 * Vue d'un bloc selon le mode.
 *
 * Hors mode Ultra Design, effets et séquences sont ignorés au RENDU mais restent
 * intacts dans les données : couper le mode ne détruit rien, il montre le projet
 * tel qu'il apparaîtrait sans les fonctions avancées. La présentation doit s'y
 * conformer aussi, sinon couper le mode n'a aucun effet une fois lancée.
 */
export function viewBlock(block: BlockData, ultra: boolean): BlockData {
  if (ultra) return block
  if (!block.effects && !block.motion) return block
  return { ...block, effects: undefined, motion: undefined }
}
