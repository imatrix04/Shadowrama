import type { MotionPreset } from '../types'

/**
 * Bibliothèque de mouvements.
 *
 * Un preset n'est pas une transition unique mais une suite d'étapes : c'est ce
 * qui permet des mouvements composés — dépasser puis revenir, tomber puis
 * rebondir, apparaître par caractères. L'ancien modèle (`AnimationConfig`) ne
 * savait interpoler qu'un seul état vers un autre.
 *
 * Les décalages `x`/`y` sont en pixels, les rotations en degrés, `blur` en
 * pixels. `from` décrit l'état avant démarrage ; chaque étape mène au suivant.
 *
 * `tier: 'basic'` marque les presets issus de l'ancien panneau Animations :
 * ils restent actifs même le mode Ultra Design coupé (voir `viewBlock` dans
 * `ultra/effectStyle.ts`). Tout le reste est `'ultra'`.
 */
export const MOTION_PRESETS: MotionPreset[] = [
  // ── Fondus ────────────────────────────────────────────────────────────────
  {
    id: 'fade',
    label: 'Fondu',
    tier: 'basic',
    phase: 'in',
    family: 'fondu',
    from: { opacity: 0 },
    steps: [{ to: { opacity: 1 }, duration: 0.5, ease: 'power2.out' }],
  },
  {
    id: 'fade-up',
    label: 'Fondu montant',
    tier: 'ultra',
    phase: 'in',
    family: 'fondu',
    from: { opacity: 0, y: 40 },
    steps: [{ to: { opacity: 1, y: 0 }, duration: 0.6, ease: 'power3.out' }],
  },
  {
    id: 'fade-scale',
    label: 'Fondu ample',
    tier: 'ultra',
    phase: 'in',
    family: 'fondu',
    from: { opacity: 0, scale: 1.12 },
    steps: [{ to: { opacity: 1, scale: 1 }, duration: 0.7, ease: 'power2.out' }],
  },

  // ── Glissements ───────────────────────────────────────────────────────────
  {
    id: 'slide-left',
    label: 'Glisse depuis la gauche',
    tier: 'basic',
    phase: 'in',
    family: 'glissement',
    from: { opacity: 0, x: -120 },
    steps: [{ to: { opacity: 1, x: 0 }, duration: 0.6, ease: 'power3.out' }],
  },
  {
    id: 'slide-right',
    label: 'Glisse depuis la droite',
    tier: 'basic',
    phase: 'in',
    family: 'glissement',
    from: { opacity: 0, x: 120 },
    steps: [{ to: { opacity: 1, x: 0 }, duration: 0.6, ease: 'power3.out' }],
  },
  {
    id: 'slide-up',
    label: 'Depuis le bas',
    tier: 'basic',
    phase: 'in',
    family: 'glissement',
    from: { opacity: 0, y: 40 },
    steps: [{ to: { opacity: 1, y: 0 }, duration: 0.6, ease: 'power2.out' }],
  },
  {
    id: 'slide-overshoot',
    label: 'Glisse et dépasse',
    tier: 'ultra',
    phase: 'in',
    family: 'glissement',
    from: { opacity: 0, x: -160 },
    steps: [
      { to: { opacity: 1, x: 24 }, duration: 0.45, ease: 'power3.out' },
      { to: { x: 0 }, duration: 0.35, ease: 'power2.inOut' },
    ],
  },
  {
    id: 'drop-bounce',
    label: 'Tombe et rebondit',
    tier: 'ultra',
    phase: 'in',
    family: 'glissement',
    from: { opacity: 0, y: -180 },
    steps: [
      { to: { opacity: 1, y: 0 }, duration: 0.5, ease: 'power3.in' },
      { to: { y: -28, scale: 1.04 }, duration: 0.22, ease: 'power2.out' },
      { to: { y: 0, scale: 1 }, duration: 0.3, ease: 'bounce.out' },
    ],
  },

  // ── Échelle ───────────────────────────────────────────────────────────────
  {
    id: 'zoom-in',
    label: 'Zoom',
    tier: 'basic',
    phase: 'in',
    family: 'echelle',
    from: { opacity: 0, scale: 0.8 },
    steps: [{ to: { opacity: 1, scale: 1 }, duration: 0.5, ease: 'power2.out' }],
  },
  {
    id: 'pop',
    label: 'Apparition élastique',
    tier: 'ultra',
    phase: 'in',
    family: 'echelle',
    from: { opacity: 0, scale: 0.4 },
    steps: [{ to: { opacity: 1, scale: 1 }, duration: 0.8, ease: 'elastic.out(1, 0.45)' }],
  },
  {
    id: 'pop-punch',
    label: 'Coup de poing',
    tier: 'ultra',
    phase: 'in',
    family: 'echelle',
    from: { opacity: 0, scale: 0.6 },
    steps: [
      { to: { opacity: 1, scale: 1.18 }, duration: 0.22, ease: 'power4.out' },
      { to: { scale: 0.96 }, duration: 0.14, ease: 'power2.inOut' },
      { to: { scale: 1 }, duration: 0.2, ease: 'power2.out' },
    ],
  },
  {
    id: 'grow-wide',
    label: 'Étirement horizontal',
    tier: 'ultra',
    phase: 'in',
    family: 'echelle',
    from: { opacity: 0, scale: 0.2, skewX: -12 },
    steps: [
      { to: { opacity: 1, scale: 1.05, skewX: 4 }, duration: 0.4, ease: 'power3.out' },
      { to: { scale: 1, skewX: 0 }, duration: 0.25, ease: 'power2.out' },
    ],
  },

  // ── Rotations ─────────────────────────────────────────────────────────────
  {
    id: 'spin-in',
    label: 'Rotation entrante',
    tier: 'ultra',
    phase: 'in',
    family: 'rotation',
    from: { opacity: 0, rotate: -25, scale: 0.7 },
    steps: [
      { to: { opacity: 1, rotate: 4, scale: 1.03 }, duration: 0.5, ease: 'power3.out' },
      { to: { rotate: 0, scale: 1 }, duration: 0.3, ease: 'power2.inOut' },
    ],
  },
  {
    id: 'flip-x',
    label: 'Bascule',
    tier: 'ultra',
    phase: 'in',
    family: 'rotation',
    from: { opacity: 0, skewY: 18, scale: 0.85 },
    steps: [
      { to: { opacity: 1, skewY: -6, scale: 1 }, duration: 0.42, ease: 'power3.out' },
      { to: { skewY: 0 }, duration: 0.28, ease: 'power2.out' },
    ],
  },

  // ── Flous ─────────────────────────────────────────────────────────────────
  {
    id: 'blur-in',
    label: 'Sortie de flou',
    tier: 'ultra',
    phase: 'in',
    family: 'flou',
    from: { opacity: 0, blur: 18, scale: 1.08 },
    steps: [{ to: { opacity: 1, blur: 0, scale: 1 }, duration: 0.7, ease: 'power2.out' }],
  },
  {
    id: 'blur-rush',
    label: 'Ruée floue',
    tier: 'ultra',
    phase: 'in',
    family: 'flou',
    from: { opacity: 0, blur: 24, x: -90 },
    steps: [
      { to: { opacity: 1, blur: 0, x: 12 }, duration: 0.42, ease: 'power4.out' },
      { to: { x: 0 }, duration: 0.3, ease: 'power2.out' },
    ],
  },

  // ── Texte découpé ─────────────────────────────────────────────────────────
  {
    id: 'type-chars',
    label: 'Machine à écrire',
    tier: 'ultra',
    phase: 'in',
    family: 'texte',
    from: { opacity: 0 },
    steps: [{ to: { opacity: 1 }, duration: 0.01, ease: 'none' }],
    split: 'chars',
  },
  {
    id: 'wave-chars',
    label: 'Vague par lettres',
    tier: 'ultra',
    phase: 'in',
    family: 'texte',
    from: { opacity: 0, y: 28, rotate: -8 },
    steps: [{ to: { opacity: 1, y: 0, rotate: 0 }, duration: 0.5, ease: 'back.out(2)' }],
    split: 'chars',
  },
  {
    id: 'words-up',
    label: 'Mots montants',
    tier: 'ultra',
    phase: 'in',
    family: 'texte',
    from: { opacity: 0, y: 34, blur: 6 },
    steps: [{ to: { opacity: 1, y: 0, blur: 0 }, duration: 0.55, ease: 'power3.out' }],
    split: 'words',
  },

  // ── Sorties ───────────────────────────────────────────────────────────────

  {
    id: 'fade-out',
    label: 'Fondu de sortie',
    tier: 'basic',
    phase: 'out',
    family: 'fondu',
    from: {},
    steps: [{ to: { opacity: 0 }, duration: 0.4, ease: 'power2.in' }],
  },
  {
    id: 'slide-left-out',
    label: 'Sort vers la gauche',
    tier: 'basic',
    phase: 'out',
    family: 'glissement',
    from: {},
    steps: [{ to: { opacity: 0, x: -120 }, duration: 0.5, ease: 'power2.in' }],
  },
  {
    id: 'slide-right-out',
    label: 'Sort vers la droite',
    tier: 'basic',
    phase: 'out',
    family: 'glissement',
    from: {},
    steps: [{ to: { opacity: 0, x: 120 }, duration: 0.5, ease: 'power2.in' }],
  },
  {
    id: 'fade-down-out',
    label: 'Descend et disparaît',
    tier: 'basic',
    phase: 'out',
    family: 'glissement',
    from: {},
    steps: [{ to: { opacity: 0, y: 40 }, duration: 0.45, ease: 'power2.in' }],
  },
  {
    id: 'zoom-out',
    label: 'Zoom arrière',
    tier: 'basic',
    phase: 'out',
    family: 'echelle',
    from: {},
    steps: [{ to: { opacity: 0, scale: 0.8 }, duration: 0.5, ease: 'power2.in' }],
  },
  {
    id: 'shrink-out',
    label: 'Rétrécit',
    tier: 'ultra',
    phase: 'out',
    family: 'echelle',
    from: {},
    steps: [
      { to: { scale: 1.06 }, duration: 0.14, ease: 'power2.out' },
      { to: { opacity: 0, scale: 0.6 }, duration: 0.36, ease: 'power3.in' },
    ],
  },
  {
    id: 'blur-out',
    label: 'Part en flou',
    tier: 'ultra',
    phase: 'out',
    family: 'flou',
    from: {},
    steps: [{ to: { opacity: 0, blur: 20, scale: 1.1 }, duration: 0.5, ease: 'power2.in' }],
  },
  {
    id: 'spin-out',
    label: 'Rotation sortante',
    tier: 'ultra',
    phase: 'out',
    family: 'rotation',
    from: {},
    steps: [{ to: { opacity: 0, rotate: 20, scale: 0.7 }, duration: 0.5, ease: 'power3.in' }],
  },
]

const BY_ID = new Map(MOTION_PRESETS.map(p => [p.id, p]))

export function getPreset(id: string | undefined): MotionPreset | undefined {
  return id ? BY_ID.get(id) : undefined
}


export function presetsForPhase(phase: 'in' | 'out', ultra: boolean): MotionPreset[] {
  return MOTION_PRESETS.filter(p => p.phase === phase && (ultra || p.tier === 'basic'))
}

/** Durée totale d'un preset, utile pour enchaîner ou afficher un aperçu. */
export function presetDuration(preset: MotionPreset, speed = 1): number {
  const total = preset.steps.reduce((sum, step) => sum + step.duration, 0)
  return total / (speed || 1)
}