import { BLOCKS_CONFIG, getBlockConfig, getBlockProperties } from '../blocks'
import type { BlockData, BlockProperty, ParticleSettings, Slide, SlideBackground } from '../types'
import { MOTION_PRESETS, getPreset } from '../ultra/presets'
import {
  PARTICLE_MOTIONS, PARTICLE_MOUSE_MODES, PARTICLE_PRESETS, PARTICLE_SHAPES, mergeParticles,
} from '../ultra/particles'
import { availableTransitions, getSlideTransition } from '../ultra/slideTransitions'
import { nextId } from '../utils/ids'
import { creamInkFor, readableTextColor } from '../utils/textContrast'
import { normalizeWebUrl } from '../utils/webUrl'
import type { Attachment, ToolDef } from './types'

/**
 * Les « commandes » que l'IA peut exécuter sur le diaporama.
 *
 * Principe : l'IA ne touche jamais au projet directement. Chaque outil est une
 * fonction PURE `(diapositives, entrée) → (diapositives, résultat)`, qui valide
 * tout ce que le modèle envoie. Une entrée invalide ne modifie rien et renvoie
 * une erreur lisible, que le modèle utilise pour se corriger.
 *
 * Médias : l'IA peut créer des blocs image, vidéo ou carrousel VIDES, et y placer
 * les pièces jointes de l'utilisateur par leur numéro (set_block_media). Elle ne
 * voit jamais le contenu des fichiers, n'écrit jamais une clé média elle-même et
 * ne peut pas pointer vers une adresse distante. Elle ne touche pas non plus aux
 * fichiers, au nom du projet ou aux paramètres.
 */

export const SLIDE_WIDTH = 960
export const SLIDE_HEIGHT = 540
const MAX_SLIDES = 60
const MAX_BLOCKS_PER_SLIDE = 60
const MAX_TEXT_LENGTH = 5000
const MAX_CAROUSEL_ITEMS = 30

/** Blocs qui portent un fichier de l'utilisateur : remplis seulement par set_block_media. */
const MEDIA_BLOCKS = new Set<string>(['image', 'video', 'carousel'])

/** Champs de géométrie, communs à tous les blocs. */
const GEOMETRY_KEYS = ['x', 'y', 'width', 'height', 'zIndex'] as const

/** Plages admises par champ : un modèle distrait ne doit pas produire un texte de 5000 px. */
const NUMBER_RANGES: Record<string, [number, number]> = {
  x: [-SLIDE_WIDTH, SLIDE_WIDTH * 2],
  y: [-SLIDE_HEIGHT, SLIDE_HEIGHT * 2],
  width: [10, SLIDE_WIDTH * 2],
  height: [10, SLIDE_HEIGHT * 2],
  zIndex: [0, 1000],
  fontSize: [6, 400],
  borderRadius: [0, 500],
  borderWidth: [0, 50],
  rotation: [-360, 360],
  opacity: [0, 1],
  lineHeight: [0.5, 4],
  letterSpacing: [-20, 100],
}

const COLOR_PATTERN = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|transparent)$/i

export interface ToolContext {
  /** Mode Ultra Design actif : débloque les blocs, mouvements et transitions avancés. */
  ultra: boolean
  /** Fichiers joints par l'utilisateur dans la conversation (numérotés). */
  attachments?: Attachment[]
}

export interface ToolOutcome {
  slides: Slide[]
  /** Texte renvoyé au modèle. */
  result: string
  isError: boolean
  /** Résumé court pour l'utilisateur (« Ajout d'un titre »). Absent pour une lecture. */
  label?: string
  /** Index (0-based) de la diapositive à afficher après l'action. */
  focusSlide?: number
}

type Input = Record<string, unknown>

class ToolError extends Error {}

const fail = (message: string): never => { throw new ToolError(message) }

// ── Définitions envoyées au modèle ──────────────────────────────────────────

const slideRef = {
  type: 'integer',
  description: 'Numéro de la diapositive, en commençant à 1.',
}

export const TOOL_DEFS: ToolDef[] = [
  {
    name: 'get_reference',
    description:
      "Renvoie la référence de ce qui est possible : types de blocs et leurs propriétés, mouvements, "
      + 'transitions, taille de la diapositive. À appeler avant de créer ou modifier du contenu.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_project',
    description: "Vue d'ensemble du diaporama : une ligne par diapositive (numéro, nombre de blocs, fond, titre).",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_slide',
    description: "Contenu détaillé d'une diapositive : fond, transition et tous les blocs avec leurs propriétés et leurs id.",
    input_schema: { type: 'object', properties: { slide: slideRef }, required: ['slide'] },
  },
  {
    name: 'add_slide',
    description: 'Ajoute une diapositive vide. Sans `position`, elle est ajoutée à la fin. Renvoie son numéro.',
    input_schema: {
      type: 'object',
      properties: { position: { type: 'integer', description: 'Numéro que prendra la nouvelle diapositive.' } },
    },
  },
  {
    name: 'delete_slide',
    description: 'Supprime une diapositive et tous ses blocs. Impossible de supprimer la dernière.',
    input_schema: { type: 'object', properties: { slide: slideRef }, required: ['slide'] },
  },
  {
    name: 'move_slide',
    description: 'Déplace une diapositive à une autre position.',
    input_schema: {
      type: 'object',
      properties: { slide: slideRef, to: { type: 'integer', description: 'Nouvelle position (à partir de 1).' } },
      required: ['slide', 'to'],
    },
  },
  {
    name: 'add_block',
    description:
      'Ajoute un bloc (texte, titre, forme, image, vidéo, ou carrousel / page web en mode Ultra) sur une diapositive. '
      + 'Les blocs image, vidéo et carrousel sont créés VIDES : remplis-les ensuite avec set_block_media si '
      + "l'utilisateur a joint un fichier, sinon laisse l'emplacement vide pour qu'il y ajoute le sien. "
      + '`props` suit la liste de get_reference. Renvoie l\'id du bloc créé.',
    input_schema: {
      type: 'object',
      properties: {
        slide: slideRef,
        type: { type: 'string', enum: BLOCKS_CONFIG.map(c => c.type) },
        props: { type: 'object', description: 'Propriétés du bloc : x, y, width, height, content, color, fontSize…' },
      },
      required: ['slide', 'type'],
    },
  },
  {
    name: 'update_block',
    description: "Modifie des propriétés d'un bloc existant. Seules les propriétés fournies changent.",
    input_schema: {
      type: 'object',
      properties: { slide: slideRef, id: { type: 'integer' }, props: { type: 'object' } },
      required: ['slide', 'id', 'props'],
    },
  },
  {
    name: 'delete_block',
    description: 'Supprime un bloc.',
    input_schema: {
      type: 'object',
      properties: { slide: slideRef, id: { type: 'integer' } },
      required: ['slide', 'id'],
    },
  },
  {
    name: 'set_slide_background',
    description:
      "Change le fond d'une diapositive : couleur unie, ou dégradé (mode Ultra Design uniquement).",
    input_schema: {
      type: 'object',
      properties: {
        slide: slideRef,
        type: { type: 'string', enum: ['color', 'gradient'] },
        color: { type: 'string', description: 'Pour type=color. Ex : #1a1a2e' },
        from: { type: 'string', description: 'Pour type=gradient : couleur de départ.' },
        to: { type: 'string', description: 'Pour type=gradient : couleur d\'arrivée.' },
        angle: { type: 'number', description: 'Pour type=gradient : degrés, 0 = bas vers haut, 90 = gauche vers droite.' },
      },
      required: ['slide', 'type'],
    },
  },
  {
    name: 'set_block_media',
    description:
      "Place des pièces jointes de l'utilisateur dans un bloc image, vidéo ou carrousel existant, par leur "
      + 'numéro (voir le contexte : « Pièces jointes »). Image et vidéo : une seule pièce jointe du bon type. '
      + 'Carrousel : une ou plusieurs images, ajoutées à la suite (ou `replace` pour tout remplacer). '
      + "Tu ne vois pas le contenu des fichiers, seulement leur nom : fie-toi à ce que dit l'utilisateur.",
    input_schema: {
      type: 'object',
      properties: {
        slide: slideRef,
        id: { type: 'integer', description: 'Id du bloc image, vidéo ou carrousel.' },
        attachments: { type: 'array', items: { type: 'integer' }, description: 'Numéros de pièces jointes.' },
        replace: { type: 'boolean', description: 'Carrousel : remplace les vues existantes au lieu de les compléter.' },
      },
      required: ['slide', 'id', 'attachments'],
    },
  },
  {
    name: 'set_slide_particles',
    description:
      "Ajoute, modifie ou retire un champ de particules animé en arrière-plan d'une diapositive "
      + '(mode Ultra Design uniquement). Part d\'un `preset` (ids dans get_reference) ou des réglages '
      + 'actuels, puis applique les champs fournis. `enabled` à false retire les particules. '
      + "Le fond n'est pas modifié : choisis des couleurs de particules visibles sur ce fond.",
    input_schema: {
      type: 'object',
      properties: {
        slide: slideRef,
        enabled: { type: 'boolean', description: 'false pour désactiver les particules.' },
        preset: { type: 'string', description: "Point de départ : id de preset (get_reference)." },
        count: { type: 'integer', description: 'Nombre de particules, 1 à 300.' },
        shape: { type: 'string', enum: PARTICLE_SHAPES.map(s => s.value) },
        motion: { type: 'string', enum: PARTICLE_MOTIONS.map(m => m.value) },
        speed: { type: 'number', description: 'Multiplicateur de vitesse, 0.1 à 4. 1 = normal.' },
        size: { type: 'number', description: 'Rayon moyen en px, 1 à 30.' },
        opacity: { type: 'number', description: '0.05 à 1.' },
        colors: { type: 'array', items: { type: 'string' }, description: '1 à 4 couleurs.' },
        glow: { type: 'number', description: 'Halo en px, 0 à 40.' },
        twinkle: { type: 'boolean' },
        rotate: { type: 'boolean' },
        direction: { type: 'number', description: 'Degrés, pour motion=stream. 0 = vers la droite, 90 = vers le bas.' },
        links: { type: 'boolean', description: 'Relier les particules proches par des traits.' },
        mouse: { type: 'string', enum: PARTICLE_MOUSE_MODES.map(m => m.value), description: 'Réaction au curseur en présentation.' },
      },
      required: ['slide'],
    },
  },
  {
    name: 'set_slide_transition',
    description:
      "Règle la transition jouée EN ENTRANT sur une diapositive. `preset` à null pour la retirer. "
      + 'Ids disponibles dans get_reference.',
    input_schema: {
      type: 'object',
      properties: {
        slide: slideRef,
        preset: { type: ['string', 'null'] },
        speed: { type: 'number', description: 'Multiplicateur de vitesse, 0.25 à 4. 1 = normal.' },
      },
      required: ['slide', 'preset'],
    },
  },
  {
    name: 'set_block_motion',
    description:
      "Règle l'animation d'entrée (`in`) ou de sortie (`out`) d'un bloc. `preset` à null pour la retirer. "
      + 'Ids disponibles dans get_reference.',
    input_schema: {
      type: 'object',
      properties: {
        slide: slideRef,
        id: { type: 'integer' },
        phase: { type: 'string', enum: ['in', 'out'] },
        preset: { type: ['string', 'null'] },
        speed: { type: 'number', description: '0.25 à 4. 1 = normal.' },
        delay: { type: 'number', description: 'Secondes avant le départ, 0 à 10.' },
        stagger: { type: 'number', description: 'Pour les presets de texte : décalage entre lettres/mots, 0 à 1 s.' },
      },
      required: ['slide', 'id', 'phase', 'preset'],
    },
  },
]

// ── Validation ───────────────────────────────────────────────────────────────

function asObject(value: unknown, what: string): Input {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${what} doit être un objet.`)
  return value as Input
}

function asInt(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) fail(`${what} doit être un entier.`)
  return value as number
}

function asNumber(value: unknown, what: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${what} doit être un nombre.`)
  return Math.min(max, Math.max(min, value as number))
}

function asColor(value: unknown, what: string): string {
  if (typeof value !== 'string' || !COLOR_PATTERN.test(value.trim())) {
    fail(`${what} doit être une couleur valide (#rrggbb, rgb(), rgba(), hsl() ou transparent).`)
  }
  return (value as string).trim()
}

function slideIndex(slides: Slide[], value: unknown): number {
  const n = asInt(value, '`slide`')
  if (n < 1 || n > slides.length) fail(`Diapositive ${n} inexistante : le diaporama en compte ${slides.length}.`)
  return n - 1
}

function findBlock(slide: Slide, id: unknown): BlockData {
  const blockId = asInt(id, '`id`')
  return slide.blocks.find(b => b.id === blockId)
    ?? fail(`Bloc ${blockId} introuvable sur cette diapositive. Utilisez get_slide pour lire les id.`)
}

/** Types de champ qu'un modèle n'a pas le droit de renseigner (fichiers, formes dessinées…). */
const FORBIDDEN_PROPERTY_TYPES = new Set<BlockProperty['type']>(['file', 'carouselItems', 'shapePolygon'])

/**
 * Valide les propriétés fournies pour un type de bloc et renvoie celles à poser.
 * Tout ce qui n'est pas listé dans la config du bloc est refusé.
 */
function validateProps(type: string, rawProps: unknown): Partial<BlockData> {
  const props = asObject(rawProps ?? {}, '`props`')
  const known = new Map(getBlockProperties(type).map(p => [p.key, p]))
  const out: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(props)) {
    if ((GEOMETRY_KEYS as readonly string[]).includes(key)) {
      out[key] = Math.round(asNumber(value, `\`${key}\``, ...NUMBER_RANGES[key]))
      continue
    }
    const def = known.get(key)
    if (!def || FORBIDDEN_PROPERTY_TYPES.has(def.type)) {
      fail(`Propriété « ${key} » non modifiable pour un bloc ${type}. Voir get_reference.`)
    }
    const property = def as BlockProperty

    switch (property.type) {
      case 'text':
      case 'textarea':
        if (typeof value !== 'string') fail(`\`${key}\` doit être du texte.`)
        out[key] = (value as string).slice(0, MAX_TEXT_LENGTH)
        break
      case 'number':
      case 'float': {
        const range = NUMBER_RANGES[key] ?? [-100000, 100000]
        out[key] = asNumber(value, `\`${key}\``, range[0], range[1])
        break
      }
      case 'color':
        out[key] = asColor(value, `\`${key}\``)
        break
      case 'select': {
        const allowed = (property.options ?? []).map(o => o.value)
        if (typeof value !== 'string' || !allowed.includes(value)) {
          fail(`\`${key}\` doit valoir l'une de ces valeurs : ${allowed.join(', ')}.`)
        }
        out[key] = value
        break
      }
      case 'boolean':
        if (typeof value !== 'boolean') fail(`\`${key}\` doit être vrai ou faux.`)
        out[key] = value
        break
      case 'url': {
        const url = normalizeWebUrl(value)
        if (!url) fail(`\`${key}\` doit être une adresse web http(s) valide.`)
        out[key] = url
        break
      }
      default:
        fail(`Propriété « ${key} » non modifiable.`)
    }
  }
  return out as Partial<BlockData>
}

// ── Lecture ──────────────────────────────────────────────────────────────────

function describeBackground(bg: SlideBackground | undefined): unknown {
  if (!bg) return { type: 'color', color: 'défaut du thème' }
  const particles = bg.particles?.enabled
    ? { particles: { count: bg.particles.count, shape: bg.particles.shape, motion: bg.particles.motion, colors: bg.particles.colors } }
    : {}
  if (bg.type === 'gradient' && bg.gradient) return { type: 'gradient', ...bg.gradient, ...particles }
  if (bg.type === 'image') return { type: 'image', ...particles }
  return { type: 'color', color: bg.color, ...particles }
}

/** Bloc tel que le voit le modèle : jamais de clé média ni de données binaires. */
function describeBlock(block: BlockData): Record<string, unknown> {
  const raw = block as unknown as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue
    if (key === 'src' || key === 'items' || key === 'customShape') continue
    if (typeof value === 'string' && value.length > 1000) out[key] = `${value.slice(0, 1000)}…`
    else out[key] = value
  }
  if (block.type === 'carousel') {
    out.itemCount = (block as { items?: unknown[] }).items?.length ?? 0
  } else if (MEDIA_BLOCKS.has(block.type)) {
    out.media = (block as { src?: string }).src ? 'rempli' : 'vide'
  }
  if (MEDIA_BLOCKS.has(block.type)) out.note = "Fichier de l'utilisateur : posé uniquement avec set_block_media."
  return out
}

function firstText(slide: Slide): string | undefined {
  const block = slide.blocks.find(b => b.type === 'title') ?? slide.blocks.find(b => b.type === 'text')
  const content = (block as { content?: string } | undefined)?.content
  return content ? content.replace(/\s+/g, ' ').slice(0, 80) : undefined
}

function reference(ctx: ToolContext) {
  return {
    slide: { width: SLIDE_WIDTH, height: SLIDE_HEIGHT, unit: 'px', origin: 'coin supérieur gauche' },
    blocks: BLOCKS_CONFIG
      .filter(c => !c.ultraOnly || ctx.ultra)
      .map(c => ({
        type: c.type,
        label: c.label,
        defaults: c.defaultProps,
        properties: getBlockProperties(c.type)
          .filter(p => !FORBIDDEN_PROPERTY_TYPES.has(p.type))
          .map(p => ({
            key: p.key, type: p.type,
            ...(p.options && { values: p.options.map(o => o.value) }),
            ...(NUMBER_RANGES[p.key] && { range: NUMBER_RANGES[p.key] }),
          })),
      })),
    geometry: GEOMETRY_KEYS.map(k => ({ key: k, range: NUMBER_RANGES[k] })),
    motionPresets: MOTION_PRESETS
      .filter(p => ctx.ultra || p.tier === 'basic')
      .map(p => ({ id: p.id, label: p.label, phase: p.phase, family: p.family })),
    slideTransitions: availableTransitions(ctx.ultra).map(t => ({ id: t.id, label: t.label })),
    ...(ctx.ultra && {
      particlePresets: PARTICLE_PRESETS.map(p => ({ id: p.id, label: p.label })),
      particleShapes: PARTICLE_SHAPES.map(s => s.value),
      particleMotions: PARTICLE_MOTIONS.map(m => m.value),
    }),
    ultraDesign: ctx.ultra,
    unavailable: ctx.ultra ? [] : ['dégradés de fond', "particules d'arrière-plan", 'bloc page web', 'mouvements et transitions avancés'],
  }
}

// ── Exécution ────────────────────────────────────────────────────────────────

const replaceSlide = (slides: Slide[], index: number, next: Slide): Slide[] =>
  slides.map((s, i) => (i === index ? next : s))

const ok = (slides: Slide[], payload: unknown, label?: string, focusSlide?: number): ToolOutcome => ({
  slides, result: JSON.stringify(payload), isError: false, label, focusSlide,
})

/**
 * Exécute un outil. Ne lève jamais : toute erreur (entrée invalide, outil
 * inconnu, bug) devient un résultat d'erreur renvoyé au modèle, et les
 * diapositives restent inchangées.
 */
export function executeTool(slides: Slide[], name: string, rawInput: unknown, ctx: ToolContext): ToolOutcome {
  try {
    const input = asObject(rawInput ?? {}, "L'entrée de l'outil")
    return run(slides, name, input, ctx)
  } catch (err) {
    const message = err instanceof ToolError ? err.message : 'Erreur interne pendant cette action.'
    if (!(err instanceof ToolError)) console.error('[ai:tool]', name, err)
    return { slides, result: `Erreur : ${message}`, isError: true }
  }
}

function run(slides: Slide[], name: string, input: Input, ctx: ToolContext): ToolOutcome {
  switch (name) {
    case 'get_reference':
      return ok(slides, reference(ctx))

    case 'get_project':
      return ok(slides, {
        slideCount: slides.length,
        slides: slides.map((s, i) => ({
          slide: i + 1, blocks: s.blocks.length, title: firstText(s),
          background: describeBackground(s.background), transition: s.transition?.preset,
        })),
      })

    case 'get_slide': {
      const i = slideIndex(slides, input.slide)
      const s = slides[i]
      return ok(slides, {
        slide: i + 1,
        background: describeBackground(s.background),
        transition: s.transition,
        blocks: s.blocks.map(describeBlock),
      })
    }

    case 'add_slide': {
      if (slides.length >= MAX_SLIDES) fail(`Limite de ${MAX_SLIDES} diapositives atteinte.`)
      const position = input.position === undefined
        ? slides.length + 1
        : Math.min(slides.length + 1, Math.max(1, asInt(input.position, '`position`')))
      const next = [...slides]
      next.splice(position - 1, 0, { id: nextId(), blocks: [] })
      return ok(next, { slide: position, slideCount: next.length }, `Nouvelle diapositive ${position}`, position - 1)
    }

    case 'delete_slide': {
      const i = slideIndex(slides, input.slide)
      if (slides.length === 1) fail('Impossible de supprimer la dernière diapositive.')
      const next = slides.filter((_, idx) => idx !== i)
      return ok(next, { deleted: i + 1, slideCount: next.length }, `Diapositive ${i + 1} supprimée`,
        Math.min(i, next.length - 1))
    }

    case 'move_slide': {
      const from = slideIndex(slides, input.slide)
      const to = Math.min(slides.length, Math.max(1, asInt(input.to, '`to`'))) - 1
      const next = [...slides]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return ok(next, { from: from + 1, to: to + 1 }, `Diapositive ${from + 1} déplacée en ${to + 1}`, to)
    }

    case 'add_block': {
      const i = slideIndex(slides, input.slide)
      const type = typeof input.type === 'string' ? input.type : fail('`type` est requis.')
      const config = getBlockConfig(type) ?? fail(`Type de bloc inconnu : « ${type} ». Voir get_reference.`)
      if (config?.ultraOnly && !ctx.ultra) fail(`Le bloc « ${type} » exige le mode Ultra Design, qui n'est pas activé.`)
      const slide = slides[i]
      if (slide.blocks.length >= MAX_BLOCKS_PER_SLIDE) fail(`Limite de ${MAX_BLOCKS_PER_SLIDE} blocs par diapositive atteinte.`)

      const props = validateProps(type, input.props)
      const block = {
        x: 100, y: 100, width: 200, height: 60,
        ...config?.defaultProps, ...props,
        type, id: nextId(),
      } as BlockData

      // Même règle que l'ajout manuel (Editor.addBlock) : sans couleur explicite,
      // le texte et les formes restent lisibles sur le fond de la diapositive.
      if ((block.type === 'text' || block.type === 'title') && !('color' in props)) {
        block.color = readableTextColor(slide.background, ctx.ultra)
      }
      if (block.type === 'shape') {
        if (!('backgroundColor' in props)) block.backgroundColor = creamInkFor(slide.background, ctx.ultra)
        if (!('borderColor' in props)) block.borderColor = creamInkFor(slide.background, ctx.ultra, true)
      }

      const next = replaceSlide(slides, i, { ...slide, blocks: [...slide.blocks, block] })
      return ok(next, { id: block.id, slide: i + 1 }, `Ajout d'un bloc ${config?.label.toLowerCase()}`, i)
    }

    case 'update_block': {
      const i = slideIndex(slides, input.slide)
      const slide = slides[i]
      const block = findBlock(slide, input.id)
      // Les champs « fichier » (src, items) sont refusés par validateProps : seul set_block_media les pose.
      const changes = validateProps(block.type, input.props)
      if (Object.keys(changes).length === 0) fail('Aucune propriété à modifier.')
      const next = replaceSlide(slides, i, {
        ...slide,
        blocks: slide.blocks.map(b => (b.id === block.id ? ({ ...b, ...changes } as BlockData) : b)),
      })
      return ok(next, { id: block.id, updated: Object.keys(changes) }, 'Bloc modifié', i)
    }

    case 'delete_block': {
      const i = slideIndex(slides, input.slide)
      const slide = slides[i]
      const block = findBlock(slide, input.id)
      const next = replaceSlide(slides, i, { ...slide, blocks: slide.blocks.filter(b => b.id !== block.id) })
      return ok(next, { deleted: block.id }, 'Bloc supprimé', i)
    }

    case 'set_slide_background': {
      const i = slideIndex(slides, input.slide)
      let background: SlideBackground
      if (input.type === 'color') {
        background = { type: 'color', color: asColor(input.color, '`color`') }
      } else if (input.type === 'gradient') {
        if (!ctx.ultra) fail("Les dégradés de fond exigent le mode Ultra Design, qui n'est pas activé. Utilisez type=color.")
        background = {
          type: 'gradient',
          gradient: {
            from: asColor(input.from, '`from`'),
            to: asColor(input.to, '`to`'),
            angle: input.angle === undefined ? 135 : asNumber(input.angle, '`angle`', 0, 360),
          },
        }
      } else {
        fail('`type` doit valoir « color » ou « gradient ».')
      }
      // Les particules et la superposition vivent dans le fond : on les garde.
      const previous = slides[i].background
      if (previous?.particles) background!.particles = previous.particles
      if (previous?.overlay && background!.type !== 'color') background!.overlay = previous.overlay
      const next = replaceSlide(slides, i, { ...slides[i], background: background! })
      return ok(next, { slide: i + 1, background: describeBackground(background!) }, `Fond de la diapositive ${i + 1}`, i)
    }

    case 'set_block_media': {
      const i = slideIndex(slides, input.slide)
      const slide = slides[i]
      const block = findBlock(slide, input.id)
      if (!MEDIA_BLOCKS.has(block.type)) fail("Ce bloc n'est pas un bloc image, vidéo ou carrousel.")
      if (block.type === 'carousel' && !ctx.ultra) fail("Le carrousel exige le mode Ultra Design, qui n'est pas activé.")

      const available = ctx.attachments ?? []
      if (available.length === 0) fail("Aucune pièce jointe : demande à l'utilisateur d'en joindre une dans la conversation.")
      if (!Array.isArray(input.attachments) || input.attachments.length === 0) {
        fail('`attachments` doit être une liste de numéros de pièces jointes.')
      }
      const picked = (input.attachments as unknown[]).map(ref => {
        const n = asInt(ref, '`attachments`')
        return available.find(a => a.id === n)
          ?? fail(`Pièce jointe ${n} inexistante. Disponibles : ${available.map(a => a.id).join(', ')}.`)
      })
      const wanted = block.type === 'video' ? 'video' : 'image'
      const wrong = picked.find(a => a.kind !== wanted)
      if (wrong) {
        fail(`La pièce jointe ${wrong.id} (${wrong.name}) est ${wrong.kind === 'video' ? 'une vidéo' : 'une image'} : ce bloc attend ${wanted === 'video' ? 'une vidéo' : 'une image'}.`)
      }

      let changes: Partial<BlockData>
      if (block.type === 'carousel') {
        const existing = input.replace === true ? [] : (block as { items?: unknown[] }).items ?? []
        if (existing.length + picked.length > MAX_CAROUSEL_ITEMS) fail(`Un carrousel est limité à ${MAX_CAROUSEL_ITEMS} images.`)
        const added = picked.map(a => ({ id: nextId(), src: a.key, alt: a.name, objectFit: 'cover' as const }))
        changes = { items: [...existing, ...added] } as Partial<BlockData>
      } else {
        if (picked.length !== 1) fail("Ce bloc n'accepte qu'une seule pièce jointe.")
        changes = (block.type === 'image'
          ? { src: picked[0].key, alt: picked[0].name }
          : { src: picked[0].key }) as Partial<BlockData>
      }
      const next = replaceSlide(slides, i, {
        ...slide,
        blocks: slide.blocks.map(b => (b.id === block.id ? ({ ...b, ...changes } as BlockData) : b)),
      })
      return ok(next, { id: block.id, placed: picked.map(a => a.id) }, 'Média ajouté', i)
    }

    case 'set_slide_particles': {
      if (!ctx.ultra) fail("Les particules d'arrière-plan exigent le mode Ultra Design, qui n'est pas activé.")
      const i = slideIndex(slides, input.slide)
      const bg: SlideBackground = slides[i].background ?? { type: 'color' }
      const label = `Particules de la diapositive ${i + 1}`

      if (input.enabled === false) {
        if (!bg.particles) return ok(slides, { slide: i + 1, particles: 'aucune' }, undefined, i)
        const off = replaceSlide(slides, i, { ...slides[i], background: { ...bg, particles: { ...bg.particles, enabled: false } } })
        return ok(off, { slide: i + 1, particles: 'désactivées' }, label, i)
      }

      let base: Partial<ParticleSettings> | undefined = bg.particles
      if (input.preset !== undefined) {
        const preset = PARTICLE_PRESETS.find(p => p.id === input.preset)
        if (!preset) fail(`Preset « ${String(input.preset)} » inconnu. Disponibles : ${PARTICLE_PRESETS.map(p => p.id).join(', ')}.`)
        base = preset!.settings
      }
      const p = mergeParticles(base)
      const oneOf = <T extends string>(value: unknown, list: { value: T }[], what: string): T => {
        const found = list.find(o => o.value === value)
        if (!found) fail(`${what} doit valoir : ${list.map(o => o.value).join(', ')}.`)
        return found!.value
      }
      const flag = (value: unknown, what: string): boolean => {
        if (typeof value !== 'boolean') fail(`${what} doit être true ou false.`)
        return value as boolean
      }

      p.enabled = true
      if (input.count !== undefined) p.count = Math.round(asNumber(input.count, '`count`', 1, 300))
      if (input.shape !== undefined) p.shape = oneOf(input.shape, PARTICLE_SHAPES, '`shape`')
      if (input.motion !== undefined) p.motion = oneOf(input.motion, PARTICLE_MOTIONS, '`motion`')
      if (input.speed !== undefined) p.speed = asNumber(input.speed, '`speed`', 0.1, 4)
      if (input.size !== undefined) p.size = asNumber(input.size, '`size`', 1, 30)
      if (input.opacity !== undefined) p.opacity = asNumber(input.opacity, '`opacity`', 0.05, 1)
      if (input.glow !== undefined) p.glow = asNumber(input.glow, '`glow`', 0, 40)
      if (input.direction !== undefined) p.direction = asNumber(input.direction, '`direction`', 0, 360)
      if (input.twinkle !== undefined) p.twinkle = flag(input.twinkle, '`twinkle`')
      if (input.rotate !== undefined) p.rotate = flag(input.rotate, '`rotate`')
      if (input.links !== undefined) p.links = { ...p.links, enabled: flag(input.links, '`links`') }
      if (input.mouse !== undefined) p.mouse = { ...p.mouse, mode: oneOf(input.mouse, PARTICLE_MOUSE_MODES, '`mouse`') }
      if (input.colors !== undefined) {
        if (!Array.isArray(input.colors) || input.colors.length < 1 || input.colors.length > 4) {
          fail('`colors` doit contenir de 1 à 4 couleurs.')
        }
        p.colors = (input.colors as unknown[]).map(c => asColor(c, '`colors`'))
      }

      const next = replaceSlide(slides, i, { ...slides[i], background: { ...bg, particles: p } })
      return ok(next, { slide: i + 1, particles: p }, label, i)
    }

    case 'set_slide_transition': {
      const i = slideIndex(slides, input.slide)
      let transition: Slide['transition']
      if (input.preset === null) {
        transition = undefined
      } else {
        const id = typeof input.preset === 'string' ? input.preset : fail('`preset` doit être un id ou null.')
        const preset = getSlideTransition(id) ?? fail(`Transition inconnue : « ${id} ». Voir get_reference.`)
        if (preset.tier === 'ultra' && !ctx.ultra) fail(`La transition « ${id} » exige le mode Ultra Design.`)
        transition = { preset: id }
        if (input.speed !== undefined) transition.speed = asNumber(input.speed, '`speed`', 0.25, 4)
      }
      const next = replaceSlide(slides, i, { ...slides[i], transition })
      return ok(next, { slide: i + 1, transition: transition?.preset ?? null }, `Transition de la diapositive ${i + 1}`, i)
    }

    case 'set_block_motion': {
      const i = slideIndex(slides, input.slide)
      const slide = slides[i]
      const block = findBlock(slide, input.id)
      const phase = input.phase === 'in' || input.phase === 'out' ? input.phase : fail('`phase` doit valoir « in » ou « out ».')
      const motion = { ...block.motion }
      if (input.preset === null) {
        delete motion[phase]
      } else {
        const id = typeof input.preset === 'string' ? input.preset : fail('`preset` doit être un id ou null.')
        const preset = getPreset(id) ?? fail(`Mouvement inconnu : « ${id} ». Voir get_reference.`)
        if (preset.phase !== phase) fail(`« ${id} » est un mouvement de ${preset.phase === 'in' ? 'entrée' : 'sortie'}, pas de ${phase === 'in' ? 'entrée' : 'sortie'}.`)
        if (preset.tier === 'ultra' && !ctx.ultra) fail(`Le mouvement « ${id} » exige le mode Ultra Design.`)
        const settings: NonNullable<typeof motion.in> = { preset: id }
        if (input.speed !== undefined) settings.speed = asNumber(input.speed, '`speed`', 0.25, 4)
        if (input.delay !== undefined) settings.delay = asNumber(input.delay, '`delay`', 0, 10)
        if (input.stagger !== undefined) settings.stagger = asNumber(input.stagger, '`stagger`', 0, 1)
        motion[phase] = settings
      }
      const next = replaceSlide(slides, i, {
        ...slide,
        blocks: slide.blocks.map(b => (b.id === block.id ? ({ ...b, motion } as BlockData) : b)),
      })
      return ok(next, { id: block.id, phase, preset: input.preset }, 'Animation réglée', i)
    }

    default:
      return fail(`Outil inconnu : « ${name} ».`)
  }
}
