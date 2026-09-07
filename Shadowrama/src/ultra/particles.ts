import type {
  ParticleMotion,
  ParticleMouseMode,
  ParticleSettings,
  ParticleShape,
} from '../types'

/** Vitesse de référence, en pixels par seconde, pour `speed = 1`. */
const BASE_SPEED = 34
/** Au-delà, le calcul des liens (O(n²)) coûte plus qu'il n'apporte. */
const LINK_LIMIT = 220
const MAX_DPR = 2
const TWO_PI = Math.PI * 2

export const PARTICLE_SHAPES: { value: ParticleShape; label: string }[] = [
  { value: 'circle', label: 'Point' },
  { value: 'glow', label: 'Halo' },
  { value: 'square', label: 'Carré' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'star', label: 'Étoile' },
  { value: 'ring', label: 'Anneau' },
  { value: 'line', label: 'Trait' },
  { value: 'cross', label: 'Croix' },
]

export const PARTICLE_MOTIONS: { value: ParticleMotion; label: string }[] = [
  { value: 'drift', label: 'Dérive' },
  { value: 'stream', label: 'Flux' },
  { value: 'rise', label: 'Montée' },
  { value: 'fall', label: 'Chute' },
  { value: 'swirl', label: 'Tourbillon' },
  { value: 'wave', label: 'Ondulation' },
  { value: 'pulse', label: 'Pulsation' },
]

export const PARTICLE_MOUSE_MODES: { value: ParticleMouseMode; label: string }[] = [
  { value: 'none', label: 'Aucune' },
  { value: 'repel', label: 'Repousser' },
  { value: 'attract', label: 'Attirer' },
  { value: 'grow', label: 'Grossir' },
  { value: 'connect', label: 'Relier' },
]

export const DEFAULT_PARTICLES: ParticleSettings = {
  enabled: true,
  count: 80,
  shape: 'circle',
  motion: 'drift',
  speed: 1,
  size: 3,
  sizeVariation: 0.5,
  opacity: 0.75,
  colors: ['#7c5cff', '#00d4ff'],
  glow: 8,
  additive: true,
  twinkle: false,
  rotate: false,
  direction: 45,
  links: { enabled: false, distance: 120, width: 1 },
  mouse: { mode: 'repel', radius: 140, strength: 1 },
}

/**
 * Complète un réglage partiel — un `.shma` ancien, ou une valeur bricolée à la
 * main — pour que le moteur n'ait jamais à composer avec un champ manquant.
 */
export function mergeParticles(partial?: Partial<ParticleSettings> | null): ParticleSettings {
  return {
    ...DEFAULT_PARTICLES,
    ...(partial ?? {}),
    colors: partial?.colors?.length ? [...partial.colors] : [...DEFAULT_PARTICLES.colors],
    links: { ...DEFAULT_PARTICLES.links, ...(partial?.links ?? {}) },
    mouse: { ...DEFAULT_PARTICLES.mouse, ...(partial?.mouse ?? {}) },
  }
}

export const PARTICLE_PRESETS: { id: string; label: string; settings: ParticleSettings }[] = [
  {
    id: 'poussiere',
    label: 'Poussière',
    settings: mergeParticles({
      count: 90, shape: 'circle', motion: 'drift', speed: 0.5, size: 2,
      sizeVariation: 0.7, opacity: 0.55, colors: ['#ffffff', '#cbd5ff'],
      glow: 6, twinkle: true, mouse: { mode: 'repel', radius: 130, strength: 1 },
    }),
  },
  {
    id: 'constellation',
    label: 'Constellation',
    settings: mergeParticles({
      count: 70, shape: 'circle', motion: 'drift', speed: 0.45, size: 2.4,
      sizeVariation: 0.3, opacity: 0.8, colors: ['#7c5cff', '#00d4ff'],
      glow: 4, additive: false,
      links: { enabled: true, distance: 130, width: 1 },
      mouse: { mode: 'connect', radius: 170, strength: 1 },
    }),
  },
  {
    id: 'neige',
    label: 'Neige',
    settings: mergeParticles({
      count: 140, shape: 'circle', motion: 'fall', speed: 0.8, size: 3,
      sizeVariation: 0.8, opacity: 0.85, colors: ['#ffffff'],
      glow: 5, twinkle: false, mouse: { mode: 'repel', radius: 120, strength: 0.8 },
    }),
  },
  {
    id: 'bulles',
    label: 'Bulles',
    settings: mergeParticles({
      count: 55, shape: 'ring', motion: 'rise', speed: 0.7, size: 9,
      sizeVariation: 0.9, opacity: 0.5, colors: ['#8ee7ff', '#ffffff'],
      glow: 10, mouse: { mode: 'attract', radius: 160, strength: 0.9 },
    }),
  },
  {
    id: 'braises',
    label: 'Braises',
    settings: mergeParticles({
      count: 120, shape: 'glow', motion: 'rise', speed: 1.2, size: 4,
      sizeVariation: 0.9, opacity: 0.85, colors: ['#ff9b3d', '#ff4d4d', '#ffd166'],
      glow: 16, twinkle: true, mouse: { mode: 'repel', radius: 150, strength: 1.4 },
    }),
  },
  {
    id: 'confettis',
    label: 'Confettis',
    settings: mergeParticles({
      count: 110, shape: 'square', motion: 'stream', direction: 105, speed: 1.4,
      size: 5, sizeVariation: 0.6, opacity: 1, additive: false, rotate: true,
      colors: ['#7c5cff', '#ff5cd6', '#00d4ff', '#ffd166'],
      glow: 0, mouse: { mode: 'repel', radius: 140, strength: 1.2 },
    }),
  },
  {
    id: 'nebuleuse',
    label: 'Nébuleuse',
    settings: mergeParticles({
      count: 130, shape: 'glow', motion: 'swirl', speed: 0.6, size: 6,
      sizeVariation: 1, opacity: 0.5, colors: ['#7c5cff', '#ff5cd6'],
      glow: 22, twinkle: true, mouse: { mode: 'grow', radius: 180, strength: 1.2 },
    }),
  },
  {
    id: 'etoiles',
    label: 'Étoiles',
    settings: mergeParticles({
      count: 60, shape: 'star', motion: 'pulse', speed: 0.8, size: 5,
      sizeVariation: 0.8, opacity: 0.9, colors: ['#ffffff', '#ffe9a8'],
      glow: 12, twinkle: true, rotate: true,
      mouse: { mode: 'grow', radius: 150, strength: 1.5 },
    }),
  },
]

// ── Moteur ──────────────────────────────────────────────────────────────────

interface Particle {
  x: number; y: number
  /** Ancre : point de repos pour `pulse`, ligne de base pour `wave`. */
  bx: number; by: number
  /** Direction unitaire (dérive et flux). */
  dx: number; dy: number
  /** Facteur de vitesse propre, pour éviter un banc de poissons uniforme. */
  sf: number
  /** Décalage dû au curseur, ramené à zéro en douceur. */
  ox: number; oy: number
  /** Graines stables : la taille et la couleur d'une particule ne sautent pas
   *  quand l'utilisateur bouge un curseur de réglage. */
  seedR: number; seedC: number
  r: number
  color: string
  phase: number
  angle: number; spin: number
  orbitR: number; orbitA: number; orbitS: number
  /** Position et rendu calculés pour la frame courante (liens compris). */
  cx: number; cy: number; cr: number; ca: number
}

export interface ParticleField {
  update(next: ParticleSettings): void
  setInteractive(value: boolean): void
  destroy(): void
}

function hexToRgba(hex: string, alpha: number): string {
  let clean = hex.replace('#', '').trim()
  if (clean.length === 3) clean = clean.split('').map(c => c + c).join('')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return `rgba(255,255,255,${alpha})`
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const NOOP_FIELD: ParticleField = {
  update: () => {},
  setInteractive: () => {},
  destroy: () => {},
}

/**
 * Anime un champ de particules dans un `<canvas>` qui recouvre la diapositive.
 *
 * Le canvas se redimensionne seul (ResizeObserver) : l'appelant n'a qu'à le
 * poser en `position: absolute; inset: 0`. La boucle se met en pause quand
 * l'onglet passe en arrière-plan.
 */
export function createParticleField(
  canvas: HTMLCanvasElement,
  initial: ParticleSettings,
  options: { interactive?: boolean } = {},
): ParticleField {
  const ctx = canvas.getContext('2d')
  if (!ctx) return NOOP_FIELD

  let settings = mergeParticles(initial)
  let interactive = options.interactive ?? true

  let W = 0
  let H = 0
  let list: Particle[] = []
  let raf = 0
  let last = 0
  let t = 0
  const pointer = { x: 0, y: 0, active: false }

  // ── Fabrication ──

  function directionFor(): { x: number; y: number } {
    if (settings.motion === 'stream') {
      const a = (settings.direction * Math.PI) / 180
      // ±12° de dispersion : un flux parfaitement parallèle fait mécanique.
      const jitter = (Math.random() - 0.5) * 0.42
      return { x: Math.cos(a + jitter), y: Math.sin(a + jitter) }
    }
    const a = Math.random() * TWO_PI
    return { x: Math.cos(a), y: Math.sin(a) }
  }

  function refresh(p: Particle) {
    const v = settings.sizeVariation
    p.r = Math.max(0.4, settings.size * (1 - v / 2 + p.seedR * v))
    const colors = settings.colors.length ? settings.colors : DEFAULT_PARTICLES.colors
    p.color = colors[Math.min(colors.length - 1, Math.floor(p.seedC * colors.length))]
  }

  function initOrbit(p: Particle) {
    const span = Math.max(W, H) || 960
    p.orbitR = span * (0.08 + Math.random() * 0.46)
    p.orbitA = Math.random() * TWO_PI
    p.orbitS = (0.12 + Math.random() * 0.38) * (Math.random() < 0.5 ? -1 : 1)
  }

  function makeParticle(): Particle {
    const dir = directionFor()
    const p: Particle = {
      x: Math.random() * (W || 960),
      y: Math.random() * (H || 540),
      bx: 0, by: 0,
      dx: dir.x, dy: dir.y,
      sf: 0.6 + Math.random() * 0.8,
      ox: 0, oy: 0,
      seedR: Math.random(), seedC: Math.random(),
      r: 1, color: '#ffffff',
      phase: Math.random() * TWO_PI,
      angle: Math.random() * TWO_PI,
      spin: (Math.random() - 0.5) * 1.6,
      orbitR: 0, orbitA: 0, orbitS: 0,
      cx: 0, cy: 0, cr: 1, ca: 1,
    }
    p.bx = p.x
    p.by = p.y
    initOrbit(p)
    refresh(p)
    return p
  }

  /** Ajuste l'effectif sans tout recréer : bouger le curseur « Quantité » ne
   *  doit pas rebattre les cartes de toutes les particules déjà en place. */
  function syncCount() {
    const target = Math.max(0, Math.round(settings.count))
    while (list.length > target) list.pop()
    while (list.length < target) list.push(makeParticle())
  }

  function reseedDirections() {
    for (const p of list) {
      const dir = directionFor()
      p.dx = dir.x
      p.dy = dir.y
      p.bx = p.x
      p.by = p.y
      initOrbit(p)
    }
  }

  // ── Dimensions ──

  function resize() {
    const nextW = canvas.clientWidth
    const nextH = canvas.clientHeight
    if (nextW === W && nextH === H) return

    const ratioX = W > 0 ? nextW / W : 1
    const ratioY = H > 0 ? nextH / H : 1
    W = nextW
    H = nextH

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    canvas.width = Math.max(1, Math.round(W * dpr))
    canvas.height = Math.max(1, Math.round(H * dpr))
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

    for (const p of list) {
      p.x *= ratioX; p.y *= ratioY
      p.bx *= ratioX; p.by *= ratioY
    }
  }

  // ── Curseur ──

  function onMouseMove(e: MouseEvent) {
    if (!interactive) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    // Le canvas est mis à l'échelle par le zoom de l'éditeur ou par la scène de
    // présentation : on repasse en coordonnées logiques via le ratio du rect.
    pointer.x = (e.clientX - rect.left) * (W / rect.width)
    pointer.y = (e.clientY - rect.top) * (H / rect.height)
    pointer.active = true
  }

  function onMouseLeave() {
    pointer.active = false
  }

  // ── Rendu ──

  function drawShape(p: Particle, x: number, y: number, r: number) {
    const c = ctx!
    switch (settings.shape) {
      case 'circle':
        c.beginPath()
        c.arc(x, y, r, 0, TWO_PI)
        c.fill()
        break

      case 'glow': {
        const g = c.createRadialGradient(x, y, 0, x, y, Math.max(0.5, r * 2.6))
        g.addColorStop(0, hexToRgba(p.color, 1))
        g.addColorStop(0.4, hexToRgba(p.color, 0.45))
        g.addColorStop(1, hexToRgba(p.color, 0))
        c.fillStyle = g
        c.beginPath()
        c.arc(x, y, r * 2.6, 0, TWO_PI)
        c.fill()
        break
      }

      case 'square':
        c.save()
        c.translate(x, y)
        c.rotate(p.angle)
        c.fillRect(-r, -r, r * 2, r * 2)
        c.restore()
        break

      case 'triangle':
        c.save()
        c.translate(x, y)
        c.rotate(p.angle)
        c.beginPath()
        c.moveTo(0, -r * 1.15)
        c.lineTo(r, r * 0.85)
        c.lineTo(-r, r * 0.85)
        c.closePath()
        c.fill()
        c.restore()
        break

      case 'star': {
        c.save()
        c.translate(x, y)
        c.rotate(p.angle)
        c.beginPath()
        for (let i = 0; i < 10; i++) {
          const rad = i % 2 === 0 ? r * 1.35 : r * 0.55
          const a = (i * Math.PI) / 5 - Math.PI / 2
          const px = Math.cos(a) * rad
          const py = Math.sin(a) * rad
          if (i === 0) c.moveTo(px, py)
          else c.lineTo(px, py)
        }
        c.closePath()
        c.fill()
        c.restore()
        break
      }

      case 'ring':
        c.lineWidth = Math.max(0.6, r * 0.28)
        c.strokeStyle = p.color
        c.beginPath()
        c.arc(x, y, r, 0, TWO_PI)
        c.stroke()
        break

      case 'line':
        c.save()
        c.translate(x, y)
        c.rotate(p.angle)
        c.lineWidth = Math.max(0.6, r * 0.45)
        c.strokeStyle = p.color
        c.beginPath()
        c.moveTo(-r * 1.6, 0)
        c.lineTo(r * 1.6, 0)
        c.stroke()
        c.restore()
        break

      case 'cross':
        c.save()
        c.translate(x, y)
        c.rotate(p.angle)
        c.lineWidth = Math.max(0.6, r * 0.35)
        c.strokeStyle = p.color
        c.beginPath()
        c.moveTo(-r * 1.2, 0); c.lineTo(r * 1.2, 0)
        c.moveTo(0, -r * 1.2); c.lineTo(0, r * 1.2)
        c.stroke()
        c.restore()
        break
    }
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame)

    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    t += dt

    const c = ctx!
    c.clearRect(0, 0, W, H)
    if (W === 0 || H === 0 || list.length === 0) return

    const v = BASE_SPEED * settings.speed
    const useMouse = interactive && pointer.active && settings.mouse.mode !== 'none'
    const decay = Math.min(1, 2.4 * dt)

    // ── 1. Mise à jour ──
    for (const p of list) {
      switch (settings.motion) {
        case 'drift':
        case 'stream':
          p.x += p.dx * v * p.sf * dt
          p.y += p.dy * v * p.sf * dt
          if (p.x < -p.r * 3) p.x = W + p.r * 3
          else if (p.x > W + p.r * 3) p.x = -p.r * 3
          if (p.y < -p.r * 3) p.y = H + p.r * 3
          else if (p.y > H + p.r * 3) p.y = -p.r * 3
          break

        case 'rise':
          p.y -= v * p.sf * dt
          p.x += Math.sin(t * 0.9 + p.phase) * v * 0.3 * dt
          if (p.y < -p.r * 3) { p.y = H + p.r * 3; p.x = Math.random() * W }
          break

        case 'fall':
          p.y += v * p.sf * dt
          p.x += Math.sin(t * 0.7 + p.phase) * v * 0.4 * dt
          if (p.y > H + p.r * 3) { p.y = -p.r * 3; p.x = Math.random() * W }
          break

        case 'swirl':
          p.orbitA += p.orbitS * settings.speed * dt
          p.x = W / 2 + Math.cos(p.orbitA) * p.orbitR
          // Ellipse plutôt que cercle : la diapositive est en 16/9.
          p.y = H / 2 + Math.sin(p.orbitA) * p.orbitR * 0.6
          break

        case 'wave':
          p.bx += v * p.sf * dt
          if (p.bx > W + p.r * 3) p.bx = -p.r * 3
          p.x = p.bx
          p.y = p.by + Math.sin(t * 1.2 * settings.speed + p.phase) * (16 + p.r * 3)
          break

        case 'pulse':
          p.x = p.bx
          p.y = p.by
          break
      }

      if (settings.rotate) p.angle += p.spin * settings.speed * dt

      let scale = 1
      if (useMouse) {
        const dxm = p.x + p.ox - pointer.x
        const dym = p.y + p.oy - pointer.y
        const d = Math.hypot(dxm, dym)
        const R = settings.mouse.radius
        if (d < R && d > 0.001) {
          const f = (1 - d / R) * settings.mouse.strength
          if (settings.mouse.mode === 'repel') {
            p.ox += (dxm / d) * f * 280 * dt
            p.oy += (dym / d) * f * 280 * dt
          } else if (settings.mouse.mode === 'attract') {
            p.ox -= (dxm / d) * f * 220 * dt
            p.oy -= (dym / d) * f * 220 * dt
          } else if (settings.mouse.mode === 'grow') {
            scale = 1 + f * 1.8
          }
        }
      }
      // Rappel élastique : le décalage n'est jamais définitif, la particule
      // rejoint sa trajectoire dès que le curseur s'éloigne.
      p.ox -= p.ox * decay
      p.oy -= p.oy * decay

      let alpha = settings.opacity
      if (settings.twinkle) {
        alpha *= 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2.2 + p.phase * 3))
      }
      if (settings.motion === 'pulse') {
        scale *= 0.65 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.6 * settings.speed + p.phase))
      }

      p.cx = p.x + p.ox
      p.cy = p.y + p.oy
      p.cr = Math.max(0.3, p.r * scale)
      p.ca = Math.max(0, Math.min(1, alpha))
    }

    c.globalCompositeOperation = settings.additive ? 'lighter' : 'source-over'

    // ── 2. Liens (sous les particules) ──
    if (settings.links.enabled && list.length <= LINK_LIMIT) {
      const D = settings.links.distance
      c.shadowBlur = 0
      c.lineWidth = Math.max(0.4, settings.links.width)
      for (let i = 0; i < list.length; i++) {
        const a = list[i]
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j]
          const dx = a.cx - b.cx
          const dy = a.cy - b.cy
          const d2 = dx * dx + dy * dy
          if (d2 > D * D) continue
          const d = Math.sqrt(d2)
          c.globalAlpha = (1 - d / D) * settings.opacity * 0.6
          c.strokeStyle = settings.links.color || a.color
          c.beginPath()
          c.moveTo(a.cx, a.cy)
          c.lineTo(b.cx, b.cy)
          c.stroke()
        }
      }
    }

    // ── 3. Liens vers le curseur ──
    if (useMouse && settings.mouse.mode === 'connect') {
      const R = settings.mouse.radius
      c.shadowBlur = 0
      c.lineWidth = Math.max(0.4, settings.links.width)
      for (const p of list) {
        const d = Math.hypot(p.cx - pointer.x, p.cy - pointer.y)
        if (d > R) continue
        c.globalAlpha = (1 - d / R) * settings.opacity * 0.85
        c.strokeStyle = settings.links.color || p.color
        c.beginPath()
        c.moveTo(p.cx, p.cy)
        c.lineTo(pointer.x, pointer.y)
        c.stroke()
      }
    }

    // ── 4. Particules ──
    for (const p of list) {
      c.globalAlpha = p.ca
      c.fillStyle = p.color
      if (settings.glow > 0) {
        c.shadowBlur = settings.glow
        c.shadowColor = p.color
      } else {
        c.shadowBlur = 0
      }
      drawShape(p, p.cx, p.cy, p.cr)
    }

    c.globalAlpha = 1
    c.shadowBlur = 0
    c.globalCompositeOperation = 'source-over'
  }

  function start() {
    if (raf) return
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }

  function stop() {
    if (!raf) return
    cancelAnimationFrame(raf)
    raf = 0
  }

  function onVisibility() {
    if (document.hidden) stop()
    else start()
  }

  // ── Amorçage ──

  const observer = new ResizeObserver(() => resize())
  observer.observe(canvas)
  resize()
  syncCount()

  window.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseleave', onMouseLeave)
  document.addEventListener('visibilitychange', onVisibility)
  start()

  return {
    update(next: ParticleSettings) {
      const prev = settings
      settings = mergeParticles(next)
      if (settings.motion !== prev.motion || settings.direction !== prev.direction) {
        reseedDirections()
      }
      if (settings.count !== prev.count) syncCount()
      if (
        settings.size !== prev.size ||
        settings.sizeVariation !== prev.sizeVariation ||
        settings.colors.join() !== prev.colors.join()
      ) {
        for (const p of list) refresh(p)
      }
    },
    setInteractive(value: boolean) {
      interactive = value
      if (!value) pointer.active = false
    },
    destroy() {
      stop()
      observer.disconnect()
      window.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseleave', onMouseLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      list = []
    },
  }
}