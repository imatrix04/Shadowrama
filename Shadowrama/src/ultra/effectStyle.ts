import type { BlockData, BlockEffects, BlockMotion, Gradient } from '../types'
import { getPreset } from './presets'


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


/** Ne garde d'une séquence que ses phases `tier: 'basic'` : c'est ce qui
 *  permet aux anciennes Animations — fusionnées dans Mouvement — de
 *  continuer à jouer même le mode Ultra Design coupé, alors qu'une séquence
 *  Ultra reste, elle, neutralisée. */
function stripUltraMotion(motion: BlockMotion | undefined): BlockMotion | undefined {
  if (!motion) return motion
  const keepIn = motion.in && getPreset(motion.in.preset)?.tier !== 'ultra'
  const keepOut = motion.out && getPreset(motion.out.preset)?.tier !== 'ultra'
  if (keepIn && keepOut) return motion
  if (!keepIn && !keepOut) return undefined
  return { in: keepIn ? motion.in : undefined, out: keepOut ? motion.out : undefined }
}

/**
 * Vue d'un bloc selon le mode.
 *
 * Hors mode Ultra Design, effets et séquences ULTRA sont ignorés au RENDU
 * mais restent intacts dans les données : couper le mode ne détruit rien.
 * Les séquences `tier: 'basic'` (l'ancien panneau Animations) restent
 * actives, elles ne dépendent pas du mode. La présentation doit s'y
 * conformer aussi, sinon couper le mode n'a aucun effet une fois lancée.
 */
export function viewBlock(block: BlockData, ultra: boolean): BlockData {
  if (ultra) return block
  const motion = stripUltraMotion(block.motion)
  if (!block.effects && motion === block.motion) return block
  return { ...block, effects: undefined, motion }
}