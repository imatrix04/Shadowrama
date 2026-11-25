import { BLOCKS_CONFIG, getBlockConfig, getBlockProperties } from '../blocks'
import type {
  BlockData, BlockEffects, BlockProperty, ChartDatum, ParticleSettings, Slide, SlideBackground, SlideNumbering,
} from '../types'
import {
  DEFAULT_NUMBERING, NUMBERING_FORMATS, NUMBERING_POSITIONS, slideNumberText,
} from '../utils/numbering'
import { MOTION_PRESETS, getPreset } from '../ultra/presets'
import {
  PARTICLE_MOTIONS, PARTICLE_MOUSE_MODES, PARTICLE_PRESETS, PARTICLE_SHAPES, mergeParticles,
} from '../ultra/particles'
import { availableTransitions, getSlideTransition } from '../ultra/slideTransitions'
import { MAX_CHART_DATA } from '../utils/chart'
import { MAX_TABLE_COLS, MAX_TABLE_ROWS, normalizeCells, parseDelimited } from '../utils/table'
import type { Features } from '../hooks/useFeatures'
import { nextId } from '../utils/ids'
import { POLYGON_PRESETS } from '../utils/shapePolygon'
import type { ShapePolygon } from '../utils/shapePolygon'
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
const MIN_POLYGON_POINTS = 3
const MAX_POLYGON_POINTS = 60

const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'difference', 'exclusion', 'luminosity'] as const
const EFFECT_KEYS = [
  'shadow', 'glow', 'gradient', 'blur', 'brightness', 'saturate', 'contrast',
  'blendMode', 'corners', 'textStroke', 'float', 'glass',
] as const

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
  animSeconds: [0.1, 10],
  animDelay: [0, 10],
  ringWidth: [0.2, 0.9],
}

const COLOR_PATTERN = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|transparent)$/i

export interface ToolContext {
  /** Mode Ultra Design actif : débloque les blocs, mouvements et transitions avancés. */
  ultra: boolean
  /** Fonctionnalités bêta déverrouillées : un bloc qui en dépend est refusé sinon. */
  features?: Partial<Features>
  /** Fichiers joints par l'utilisateur dans la conversation (numérotés). */
  attachments?: Attachment[]
  /** Numérotation actuelle du projet (réglage de projet, hors diapositives). */
  numbering?: SlideNumbering
}

export interface ToolOutcome {
  slides: Slide[]
  /** Nouvelle numérotation du projet, si l'outil l'a modifiée. */
  numbering?: SlideNumbering
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
      'Ajoute un bloc (texte, titre, forme, image, vidéo, graphique, ou carrousel / page web en mode Ultra) sur une diapositive. '
      + 'GRAPHIQUE : `props.chartKind` (column, bar, line, area, pie, donut) et `props.data` = liste de { label, value, color? } ; '
      + "il s'anime à l'apparition (animated, animSeconds, cascade). "
      + `TABLEAU : \`props.cells\` = liste de lignes, chacune une liste de cellules (la première ligne est l'en-tête), `
      + `ex. [["Offre","Prix"],["Basique","9 €"]] (jusqu'à ${MAX_TABLE_ROWS} lignes × ${MAX_TABLE_COLS} colonnes), `
      + "ou du texte CSV ; la taille s'ajuste avec width/height. "
      + 'Les blocs image, vidéo et carrousel sont créés VIDES : remplis-les ensuite avec set_block_media si '
      + "l'utilisateur a joint un fichier, sinon laisse l'emplacement vide pour qu'il y ajoute le sien. "
      + '`props` suit la liste de get_reference. FORME PERSONNALISÉE : `props.customShape` = liste de points '
      + '[x, y] entre 0 et 1 (origine en haut à gauche, 3 à 60 points, dans l\'ordre du contour), ou le nom '
      + "d'un preset de get_reference ; pour un bloc forme elle passe `shape` à « grid », pour une image ou "
      + 'une vidéo elle découpe le média dans ce contour. Renvoie l\'id du bloc créé.',
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
    name: 'set_numbering',
    description:
      'Règle la numérotation des diapositives (réglage du projet entier, pas d\'une seule diapositive) : '
      + 'le numéro est affiché automatiquement sur chaque diapositive et se met à jour quand on les ajoute, '
      + 'supprime ou déplace. Utilise cet outil plutôt que d\'écrire des numéros dans des blocs texte. '
      + 'Seuls les champs fournis changent ; `enabled: true` suffit pour numéroter avec les réglages actuels.',
    input_schema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', description: 'true pour afficher les numéros, false pour les retirer.' },
        format: {
          type: 'string',
          enum: NUMBERING_FORMATS.map(f => f.value),
          description: 'n = « 3 », nn = « 03 », n-total = « 3 / 12 », roman = « III ».',
        },
        position: { type: 'string', enum: [...NUMBERING_POSITIONS] },
        size: { type: 'number', description: 'Taille en px, 10 à 72.' },
        color: { type: ['string', 'null'], description: 'Couleur ; null = automatique, lisible sur le fond de chaque diapositive.' },
        opacity: { type: 'number', description: '0.1 à 1.' },
        bold: { type: 'boolean' },
        startAt: { type: 'integer', description: 'Numéro de la première diapositive, 0 à 9999. Défaut 1.' },
        skipFirst: { type: 'boolean', description: 'true = pas de numéro sur la première diapositive (page de titre).' },
      },
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
  {
    name: 'set_block_effects',
    description:
      "Règle les effets visuels d'un bloc (mode Ultra Design uniquement). Chaque effet fourni remplace "
      + "l'actuel ; `null` retire cet effet ; `reset: true` retire d'abord tous les effets du bloc. "
      + 'Le dégradé remplace la couleur unie des formes et des textes. Reste sobre : une ombre ou un halo '
      + 'suffisent en général, et vérifie que le texte reste lisible après un flou ou un dégradé.',
    input_schema: {
      type: 'object',
      properties: {
        slide: slideRef,
        id: { type: 'integer' },
        reset: { type: 'boolean', description: 'Retire tous les effets avant d\'appliquer ceux fournis.' },
        shadow: {
          type: ['object', 'null'],
          description: 'Ombre portée. x, y : -100 à 100 ; blur : 0 à 120 ; color.',
          properties: { x: { type: 'number' }, y: { type: 'number' }, blur: { type: 'number' }, color: { type: 'string' } },
        },
        glow: {
          type: ['object', 'null'],
          description: 'Halo lumineux. blur : 0 à 80 ; color.',
          properties: { blur: { type: 'number' }, color: { type: 'string' } },
        },
        gradient: {
          type: ['object', 'null'],
          description: 'Dégradé. from, to : couleurs ; angle : 0 à 360 (0 = bas vers haut, 90 = gauche vers droite).',
          properties: { from: { type: 'string' }, to: { type: 'string' }, angle: { type: 'number' } },
        },
        blur: { type: ['number', 'null'], description: 'Flou en px, 0 à 40.' },
        brightness: { type: ['number', 'null'], description: '0 à 3, 1 = neutre.' },
        saturate: { type: ['number', 'null'], description: '0 à 3, 1 = neutre.' },
        contrast: { type: ['number', 'null'], description: '0 à 3, 1 = neutre.' },
        blendMode: { type: ['string', 'null'], enum: [...BLEND_MODES, null] },
        corners: {
          type: ['object', 'number', 'null'],
          description: 'Arrondi par coin en px, 0 à 200 : un nombre pour tous les coins, ou { tl, tr, br, bl }.',
          properties: { tl: { type: 'number' }, tr: { type: 'number' }, br: { type: 'number' }, bl: { type: 'number' } },
        },
        textStroke: {
          type: ['object', 'null'],
          description: 'Contour du texte. width : 0 à 10 ; color.',
          properties: { width: { type: 'number' }, color: { type: 'string' } },
        },
        glass: {
          type: ['object', 'null'],
          description: 'Verre dépoli (glassmorphism) : floute ce qui est DERRIÈRE le bloc, donc à placer devant une image, une forme ou un fond. blur : 0 à 60 px ; tint : couleur de la teinte ; opacity : 0 à 1 (teinte, ~0.1 à 0.25) ; radius : arrondi 0 à 200 px ; reactive : true = reflet qui suit la souris et flou renforcé au survol, false = verre statique. Optionnels : saturate 50 à 300 (%, défaut 160) ; border 0 à 1 (liseré lumineux, défaut 0.28) ; grain 0 à 1 (givre, défaut 0) ; tint2 : seconde couleur, la teinte devient un dégradé ; sheen 0 à 1 (reflet souris) ; tilt 0 à 20 (inclinaison 3D en degrés, mode réactif) ; shine : true = balayage lumineux automatique.',
          properties: { blur: { type: 'number' }, tint: { type: 'string' }, tint2: { type: 'string' }, opacity: { type: 'number' }, radius: { type: 'number' }, reactive: { type: 'boolean' }, saturate: { type: 'number' }, border: { type: 'number' }, grain: { type: 'number' }, sheen: { type: 'number' }, tilt: { type: 'number' }, shine: { type: 'boolean' } },
        },
        float: {
          type: ['object', 'null'],
          description: 'Flottement doux en boucle. amplitude : 2 à 60 px ; duration : 1 à 10 s.',
          properties: { amplitude: { type: 'number' }, duration: { type: 'number' } },
        },
      },
      required: ['slide', 'id'],
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

/**
 * Types de champ qu'un modèle ne renseigne pas par `props` : fichiers et vues de
 * carrousel (set_block_media). Le polygone, lui, a sa propre validation (asPolygon).
 */
const FORBIDDEN_PROPERTY_TYPES = new Set<BlockProperty['type']>(['file', 'carouselItems'])

/** Comparaison de noms sans accents ni casse (« Cœur » = « coeur » = « COEUR »). */
const plain = (text: string) => text
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/œ/gi, 'oe').replace(/æ/gi, 'ae')
  .trim().toLowerCase()

/**
 * Contour d'une forme personnalisée : liste de points normalisés (0–1), ou nom
 * d'un preset de l'éditeur. Les valeurs hors bornes sont ramenées dans [0, 1].
 */
function asPolygon(value: unknown): ShapePolygon {
  if (typeof value === 'string') {
    const preset = POLYGON_PRESETS.find(p => plain(p.label) === plain(value))
    if (!preset) fail(`Preset de forme « ${value} » inconnu. Disponibles : ${POLYGON_PRESETS.map(p => p.label).join(', ')}.`)
    return preset!.points.map(([x, y]) => [x, y])
  }
  if (!Array.isArray(value) || value.length < MIN_POLYGON_POINTS || value.length > MAX_POLYGON_POINTS) {
    fail(`\`customShape\` doit contenir de ${MIN_POLYGON_POINTS} à ${MAX_POLYGON_POINTS} points [x, y] (ou un nom de preset).`)
  }
  return (value as unknown[]).map((point, index) => {
    if (!Array.isArray(point) || point.length !== 2 || point.some(n => typeof n !== 'number' || !Number.isFinite(n))) {
      fail(`Point ${index + 1} de \`customShape\` invalide : attendu [x, y] avec deux nombres entre 0 et 1.`)
    }
    const [x, y] = point as [number, number]
    return [Math.round(Math.min(1, Math.max(0, x)) * 1000) / 1000, Math.round(Math.min(1, Math.max(0, y)) * 1000) / 1000]
  })
}

/** Données d'un graphique : une liste de { label, value, color? }, au moins une, valeurs positives. */
function asChartData(value: unknown): ChartDatum[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_CHART_DATA) {
    fail(`\`data\` doit être une liste de 1 à ${MAX_CHART_DATA} éléments { "label": texte, "value": nombre }.`)
  }
  return (value as unknown[]).map((item, index) => {
    const d = asObject(item, `\`data[${index}]\``)
    if (typeof d.label !== 'string') fail(`\`data[${index}].label\` doit être du texte.`)
    return {
      id: nextId(),
      label: (d.label as string).slice(0, 60),
      value: asNumber(d.value, `\`data[${index}].value\``, 0, 1e12),
      ...(d.color !== undefined && { color: asColor(d.color, `\`data[${index}].color\``) }),
    }
  })
}

/**
 * Cellules d'un tableau : liste de lignes (listes de cellules, texte ou nombres),
 * ou directement du texte CSV / tabulé. Les lignes courtes sont complétées.
 */
function asTableCells(value: unknown): string[][] {
  if (typeof value === 'string') {
    const parsed = parseDelimited(value)
    if (parsed.length === 0) fail('`cells` est vide.')
    return parsed
  }
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_TABLE_ROWS
    || value.some(row => !Array.isArray(row))) {
    fail(`\`cells\` doit être une liste de 1 à ${MAX_TABLE_ROWS} lignes, chacune une liste de cellules (ex. [["Nom","Prix"],["Thé","3"]]), ou du texte CSV.`)
  }
  if ((value as unknown[][]).some(row => row.length > MAX_TABLE_COLS)) {
    fail(`Un tableau est limité à ${MAX_TABLE_COLS} colonnes.`)
  }
  return normalizeCells(value)
}

/**
 * Valide les propriétés fournies pour un type de bloc et renvoie celles à poser.
 * Tout ce qui n'est pas listé dans la config du bloc est refusé.
 */
function validateProps(type: string, rawProps: unknown): Partial<BlockData> {
  const props = asObject(rawProps ?? {}, '`props`')
  const known = new Map(getBlockProperties(type).map(p => [p.key, p]))
  const out: Record<string, unknown> = {}
  let polygon: ShapePolygon | undefined

  for (const [key, value] of Object.entries(props)) {
    if ((GEOMETRY_KEYS as readonly string[]).includes(key)) {
      out[key] = Math.round(asNumber(value, `\`${key}\``, ...NUMBER_RANGES[key]))
      continue
    }
    const def = known.get(key)
    if (def?.type === 'shapePolygon') {
      polygon = asPolygon(value)
      continue
    }
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
      case 'chartData':
        out[key] = asChartData(value)
        break
      case 'tableData':
        out[key] = asTableCells(value)
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
  if (polygon) {
    // Poser un contour active la forme personnalisée : une forme passe à « grid »,
    // une image ou une vidéo découpe son média dans ce contour.
    out.customShape = polygon
    if (type === 'shape') out.shape = 'grid'
    else out.shapeMode = 'grid'
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
    if (key === 'src' || key === 'items') continue
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
      .filter(c => (!c.ultraOnly || ctx.ultra) && (!c.beta || ctx.features?.[c.beta]))
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
    numbering: {
      tool: 'set_numbering',
      formats: NUMBERING_FORMATS.map(f => ({ id: f.value, example: f.label })),
      positions: NUMBERING_POSITIONS,
      size: [10, 72],
    },
    customShape: {
      usage: 'props.customShape sur un bloc forme, image ou vidéo',
      points: `[x, y] entre 0 et 1, origine en haut à gauche, ${MIN_POLYGON_POINTS} à ${MAX_POLYGON_POINTS} points dans l'ordre du contour (sens horaire conseillé)`,
      presets: POLYGON_PRESETS.map(p => p.label),
    },
    ...(ctx.ultra && {
      effects: EFFECT_KEYS,
      particlePresets: PARTICLE_PRESETS.map(p => ({ id: p.id, label: p.label })),
      particleShapes: PARTICLE_SHAPES.map(s => s.value),
      particleMotions: PARTICLE_MOTIONS.map(m => m.value),
    }),
    ultraDesign: ctx.ultra,
    unavailable: ctx.ultra ? [] : ['dégradés de fond', "particules d'arrière-plan", 'effets visuels des blocs', 'bloc page web', 'mouvements et transitions avancés'],
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
        numbering: ctx.numbering ?? DEFAULT_NUMBERING,
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
      if (config?.beta && !ctx.features?.[config.beta]) {
        fail(`Le bloc « ${type} » est une fonctionnalité bêta, non activée : l'utilisateur doit l'activer dans Paramètres → Fonctionnalités.`)
      }
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
      if (block.type === 'table' && !('textColor' in props)) {
        block.textColor = readableTextColor(slide.background, ctx.ultra)
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

    case 'set_numbering': {
      const allowed = ['enabled', 'format', 'position', 'size', 'color', 'opacity', 'bold', 'startAt', 'skipFirst']
      const unknown = Object.keys(input).find(k => !allowed.includes(k))
      if (unknown) fail(`Champ « ${unknown} » inconnu. Champs : ${allowed.join(', ')}.`)
      if (Object.keys(input).length === 0) fail('Aucun réglage à modifier.')

      const flag = (value: unknown, what: string): boolean => {
        if (typeof value !== 'boolean') fail(`${what} doit être true ou false.`)
        return value as boolean
      }
      const current = ctx.numbering ?? DEFAULT_NUMBERING
      const n: SlideNumbering = { ...current }

      if (input.enabled !== undefined) n.enabled = flag(input.enabled, '`enabled`')
      if (input.format !== undefined) {
        const found = NUMBERING_FORMATS.find(f => f.value === input.format)
        if (!found) fail(`\`format\` doit valoir : ${NUMBERING_FORMATS.map(f => f.value).join(', ')}.`)
        n.format = found!.value
      }
      if (input.position !== undefined) {
        const found = NUMBERING_POSITIONS.find(p => p === input.position)
        if (!found) fail(`\`position\` doit valoir : ${NUMBERING_POSITIONS.join(', ')}.`)
        n.position = found!
      }
      if (input.size !== undefined) n.size = Math.round(asNumber(input.size, '`size`', 10, 72))
      if (input.opacity !== undefined) n.opacity = asNumber(input.opacity, '`opacity`', 0.1, 1)
      if (input.bold !== undefined) n.bold = flag(input.bold, '`bold`')
      if (input.skipFirst !== undefined) n.skipFirst = flag(input.skipFirst, '`skipFirst`')
      if (input.startAt !== undefined) n.startAt = Math.round(asNumber(input.startAt, '`startAt`', 0, 9999))
      if (input.color !== undefined) {
        if (input.color === null) delete n.color
        else n.color = asColor(input.color, '`color`')
      }

      const label = !n.enabled ? 'Numérotation désactivée' : current.enabled ? 'Numérotation modifiée' : 'Numérotation des diapositives'
      return {
        slides,
        numbering: n,
        isError: false,
        label,
        result: JSON.stringify({
          numbering: n,
          example: slideNumberText(Math.min(1, slides.length - 1), slides.length, { ...n, enabled: true, skipFirst: false }),
        }),
      }
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

    case 'set_block_effects': {
      if (!ctx.ultra) fail("Les effets visuels exigent le mode Ultra Design, qui n'est pas activé.")
      const i = slideIndex(slides, input.slide)
      const slide = slides[i]
      const block = findBlock(slide, input.id)
      const unknown = Object.keys(input).find(k => !['slide', 'id', 'reset', ...EFFECT_KEYS].includes(k))
      if (unknown) fail(`Champ « ${unknown} » inconnu. Effets : ${EFFECT_KEYS.join(', ')}.`)

      const effects: Record<string, unknown> = input.reset === true ? {} : { ...block.effects }
      const given = EFFECT_KEYS.filter(k => input[k] !== undefined)
      if (given.length === 0 && input.reset !== true) fail('Aucun effet à modifier.')

      const num = (o: Input, key: string, min: number, max: number, fallback?: number) =>
        o[key] === undefined && fallback !== undefined ? fallback : asNumber(o[key], `\`${key}\``, min, max)
      const color = (o: Input, key: string, fallback: string) =>
        o[key] === undefined ? fallback : asColor(o[key], `\`${key}\``)

      for (const key of given) {
        const value = input[key]
        if (value === null) { delete effects[key]; continue }
        switch (key) {
          case 'shadow': {
            const o = asObject(value, '`shadow`')
            effects.shadow = { x: num(o, 'x', -100, 100, 0), y: num(o, 'y', -100, 100, 4), blur: num(o, 'blur', 0, 120, 12), color: color(o, 'color', 'rgba(0,0,0,0.4)') }
            break
          }
          case 'glow': {
            const o = asObject(value, '`glow`')
            effects.glow = { blur: num(o, 'blur', 0, 80, 16), color: color(o, 'color', '#ffffff') }
            break
          }
          case 'gradient': {
            const o = asObject(value, '`gradient`')
            effects.gradient = { from: asColor(o.from, '`from`'), to: asColor(o.to, '`to`'), angle: num(o, 'angle', 0, 360, 135) }
            break
          }
          case 'blur': effects.blur = asNumber(value, '`blur`', 0, 40); break
          case 'brightness': effects.brightness = asNumber(value, '`brightness`', 0, 3); break
          case 'saturate': effects.saturate = asNumber(value, '`saturate`', 0, 3); break
          case 'contrast': effects.contrast = asNumber(value, '`contrast`', 0, 3); break
          case 'blendMode': {
            if (typeof value !== 'string' || !(BLEND_MODES as readonly string[]).includes(value)) {
              fail(`\`blendMode\` doit valoir : ${BLEND_MODES.join(', ')}.`)
            }
            effects.blendMode = value
            break
          }
          case 'corners': {
            if (typeof value === 'number') {
              const r = asNumber(value, '`corners`', 0, 200)
              effects.corners = { tl: r, tr: r, br: r, bl: r }
            } else {
              const o = asObject(value, '`corners`')
              effects.corners = { tl: num(o, 'tl', 0, 200, 0), tr: num(o, 'tr', 0, 200, 0), br: num(o, 'br', 0, 200, 0), bl: num(o, 'bl', 0, 200, 0) }
            }
            break
          }
          case 'textStroke': {
            const o = asObject(value, '`textStroke`')
            effects.textStroke = { width: num(o, 'width', 0, 10, 1), color: color(o, 'color', '#000000') }
            break
          }
          case 'glass': {
            const o = asObject(value, '`glass`')
            effects.glass = {
              blur: num(o, 'blur', 0, 60, 16),
              tint: color(o, 'tint', '#ffffff'),
              opacity: num(o, 'opacity', 0, 1, 0.12),
              radius: num(o, 'radius', 0, 200, 16),
              reactive: o.reactive !== false,
              saturate: num(o, 'saturate', 50, 300, 160),
              border: num(o, 'border', 0, 1, 0.28),
              grain: num(o, 'grain', 0, 1, 0),
              sheen: num(o, 'sheen', 0, 1, 1),
              tilt: num(o, 'tilt', 0, 20, 0),
              shine: o.shine === true,
              ...(o.tint2 != null ? { tint2: color(o, 'tint2', '#ffffff') } : {}),
            }
            break
          }
          case 'float': {
            const o = asObject(value, '`float`')
            effects.float = { amplitude: num(o, 'amplitude', 2, 60, 12), duration: num(o, 'duration', 1, 10, 4) }
            break
          }
        }
      }

      const next = replaceSlide(slides, i, {
        ...slide,
        blocks: slide.blocks.map(b => (b.id === block.id
          ? ({ ...b, effects: Object.keys(effects).length > 0 ? (effects as BlockEffects) : undefined } as BlockData)
          : b)),
      })
      return ok(next, { id: block.id, effects }, 'Effets réglés', i)
    }

    default:
      return fail(`Outil inconnu : « ${name} ».`)
  }
}
