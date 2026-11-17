import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  clamp, hexToHsv, hslToHsv, hsvToHex, hsvToHsl, hsvToRgb, normalizeHex, rgbToHsv,
} from '../../utils/color'
import type { HSV } from '../../utils/color'
import { pinColor, rememberColor, unpinColor, useColorSwatches } from '../../utils/colorSwatchStore'
import { ProjectColorsContext } from './ProjectColorsContext'
import styles from './ColorPicker.module.css'

type Mode = 'hex' | 'rgb' | 'hsl'

const MODES: { id: Mode; label: string }[] = [
  { id: 'hex', label: 'HEX' },
  { id: 'rgb', label: 'RGB' },
  { id: 'hsl', label: 'HSL' },
]

// Le format choisi la dernière fois est conservé d'une ouverture à l'autre.
let lastMode: Mode = 'hex'
const rememberMode = (mode: Mode) => { lastMode = mode }

const POPOVER_WIDTH = 264

/** API native de pipette de Chromium (donc d'Electron) ; absente des typages DOM. */
interface EyeDropperApi { open(): Promise<{ sRGBHex: string }> }
type EyeDropperCtor = new () => EyeDropperApi
const eyeDropperCtor = (): EyeDropperCtor | undefined =>
  (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper

// ── Zone de glissé (carré saturation/valeur et curseur de teinte) ────────────

function DragArea({ className, style, onDrag, onKeyStep, onKeyRelease, children, ...aria }: {
  className: string
  style?: React.CSSProperties
  /** x, y dans 0–1 ; `final` au relâchement. */
  onDrag: (x: number, y: number, final: boolean) => void
  /** Flèches du clavier : dx, dy en pas (±1), `big` avec Maj. */
  onKeyStep: (dx: number, dy: number, big: boolean) => void
  onKeyRelease: () => void
  children: ReactNode
  role: string
  'aria-label': string
  'aria-valuemin'?: number
  'aria-valuemax'?: number
  'aria-valuenow'?: number
}) {
  const report = (e: ReactPointerEvent<HTMLDivElement>, final: boolean) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    onDrag(clamp((e.clientX - rect.left) / rect.width, 0, 1), clamp((e.clientY - rect.top) / rect.height, 0, 1), final)
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
    if (!step) return
    e.preventDefault()
    onKeyStep(step[0], step[1], e.shiftKey)
  }

  return (
    <div
      className={className}
      style={style}
      tabIndex={0}
      onPointerDown={e => {
        e.currentTarget.setPointerCapture(e.pointerId)
        report(e, false)
      }}
      onPointerMove={e => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) report(e, false)
      }}
      onPointerUp={e => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
        report(e, true)
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onKeyDown={onKeyDown}
      onKeyUp={e => { if (e.key.startsWith('Arrow')) onKeyRelease() }}
      {...aria}
    >
      {children}
    </div>
  )
}

// ── Champs de saisie ─────────────────────────────────────────────────────────

/** Champ hexadécimal : valide en direct dès que la valeur est complète, et à Entrée / en quittant. */
function HexField({ hex, onCommit }: { hex: string; onCommit: (hex: string, final: boolean) => void }) {
  const [draft, setDraft] = useState<string | null>(null)

  const finish = () => {
    if (draft === null) return
    const parsed = normalizeHex(draft)
    if (parsed) onCommit(parsed, true)
    setDraft(null)
  }

  return (
    <input
      className={`${styles.field} ${styles.hexField}`}
      type="text"
      spellCheck={false}
      maxLength={7}
      aria-label="Valeur hexadécimale"
      value={draft ?? hex.toUpperCase()}
      onFocus={e => { setDraft(hex.toUpperCase()); e.currentTarget.select() }}
      onChange={e => {
        const text = e.target.value
        setDraft(text)
        // Valeur complète : on l'applique pendant la frappe, sans attendre Entrée.
        if (/^#?[0-9a-f]{6}$/i.test(text.trim())) onCommit(normalizeHex(text)!, false)
      }}
      onBlur={finish}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
    />
  )
}

/** Champ numérique borné : applique à chaque frappe valide, valide en quittant. */
function NumField({ label, value, min, max, onChange, onDone }: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  onDone: () => void
}) {
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <label className={styles.numWrap}>
      <input
        className={`${styles.field} ${styles.numField}`}
        type="text"
        inputMode="numeric"
        value={draft ?? String(Math.round(value))}
        onFocus={e => { setDraft(String(Math.round(value))); e.currentTarget.select() }}
        onChange={e => {
          const text = e.target.value.replace(/[^\d]/g, '').slice(0, 3)
          setDraft(text)
          if (text !== '') onChange(clamp(parseInt(text, 10), min, max))
        }}
        onBlur={() => { setDraft(null); onDone() }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
      />
      <span className={styles.numLabel}>{label}</span>
    </label>
  )
}

// ── Palette ──────────────────────────────────────────────────────────────────

function SwatchGrid({ colors, current, onPick, actionLabel, actionGlyph, onAction }: {
  colors: string[]
  current: string
  onPick: (color: string) => void
  actionLabel: (color: string) => string
  actionGlyph: string
  onAction: (color: string) => void
}) {
  return (
    <div className={styles.swatches}>
      {colors.map(color => (
        <span className={styles.swatchWrap} key={color}>
          <button
            type="button"
            className={`${styles.swatch} ${color === current ? styles.swatchCurrent : ''}`}
            style={{ backgroundColor: color }}
            title={color.toUpperCase()}
            aria-label={color.toUpperCase()}
            onClick={() => onPick(color)}
          />
          <button
            type="button"
            className={styles.swatchAction}
            title={actionLabel(color)}
            aria-label={actionLabel(color)}
            onClick={() => onAction(color)}
          >{actionGlyph}</button>
        </span>
      ))}
    </div>
  )
}

// ── Fenêtre du sélecteur ─────────────────────────────────────────────────────

function ColorPopover({ anchor, hex, onChange, onClose }: {
  anchor: HTMLElement
  /** Couleur actuelle, ou null si le champ est « sans couleur ». */
  hex: string | null
  onChange: (hex: string) => void
  onClose: () => void
}) {
  const popRef = useRef<HTMLDivElement>(null)
  // Pendant que la pipette est ouverte, un clic « hors de la fenêtre » est un choix de couleur.
  const picking = useRef(false)

  const current = hex ?? '#ffffff'
  // Modèle interne en HSV : la teinte survit à un passage par le blanc, le noir ou un gris.
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(current))
  const [syncedHex, setSyncedHex] = useState(current)
  if (current !== syncedHex) {
    setSyncedHex(current)
    if (hsvToHex(hsv) !== current) setHsv(hexToHsv(current))
  }

  const [mode, setModeState] = useState<Mode>(lastMode)
  const setMode = (next: Mode) => { rememberMode(next); setModeState(next) }

  const { favorites, recent } = useColorSwatches()
  const projectColors = useContext(ProjectColorsContext)

  const live = hsvToHex(hsv)
  const rgb = hsvToRgb(hsv)
  const hsl = hsvToHsl(hsv)

  const apply = (next: HSV) => {
    setHsv(next)
    const nextHex = hsvToHex(next)
    // Sans couleur au départ, même le blanc par défaut doit être appliqué.
    if (nextHex !== current || hex === null) onChange(nextHex)
  }

  /** Couleur choisie pour de bon (fin de glissé, palette, saisie validée) : elle rejoint les récentes. */
  const applyHex = (value: string, final: boolean) => {
    const parsed = normalizeHex(value)
    if (!parsed) return
    apply(hexToHsv(parsed))
    if (final) rememberColor(parsed)
  }

  const pickWithEyeDropper = async () => {
    const Ctor = eyeDropperCtor()
    if (!Ctor) return
    picking.current = true
    try {
      const result = await new Ctor().open()
      applyHex(result.sRGBHex, true)
    } catch {
      // Annulé (Échap) : rien à faire.
    } finally {
      picking.current = false
    }
  }

  // Placement : sous le champ, ou au-dessus s'il manque de la place, toujours dans la fenêtre.
  // Mesuré après chaque rendu (la hauteur change avec la palette) en écrivant directement dans le DOM.
  useLayoutEffect(() => {
    const el = popRef.current
    if (!el) return
    const a = anchor.getBoundingClientRect()
    const margin = 8
    const width = el.offsetWidth
    const height = el.offsetHeight
    const left = clamp(a.left, margin, Math.max(margin, window.innerWidth - width - margin))
    let top = a.bottom + 6
    if (top + height > window.innerHeight - margin) {
      const above = a.top - 6 - height
      top = above >= margin ? above : Math.max(margin, window.innerHeight - height - margin)
    }
    el.style.left = `${left}px`
    el.style.top = `${top}px`
    el.style.visibility = 'visible'
  })

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (picking.current) return
      const target = e.target as Node
      if (popRef.current?.contains(target) || anchor.contains(target)) return
      onClose()
    }
    // Échap ferme seulement la fenêtre : en capture, avant les autres écouteurs
    // (menu contextuel, raccourcis de l'éditeur…).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    const onScroll = (e: Event) => {
      if (!popRef.current?.contains(e.target as Node)) onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onClose)
    }
  }, [anchor, onClose])

  const canPickScreen = !!eyeDropperCtor()
  const isFavorite = favorites.includes(live)
  const KEY_STEP = 0.01

  return (
    <div
      ref={popRef}
      className={styles.popover}
      style={{ width: POPOVER_WIDTH, visibility: 'hidden' }}
      role="dialog"
      aria-label="Sélecteur de couleur"
      // Le contenu est rendu dans <body> mais reste enfant React de son champ :
      // sans ça, les mousedown / clics / touches remonteraient jusqu'au tiroir
      // (qui fait défiler au glissé), au menu contextuel ou aux raccourcis.
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => { if (e.key !== 'Tab') e.stopPropagation() }}
    >
      <DragArea
        className={styles.sv}
        style={{ ['--hue' as string]: hsv.h }}
        role="application"
        aria-label="Saturation et luminosité"
        onDrag={(x, y, final) => {
          apply({ h: hsv.h, s: x, v: 1 - y })
          if (final) rememberColor(hsvToHex({ h: hsv.h, s: x, v: 1 - y }))
        }}
        onKeyStep={(dx, dy, big) => {
          const k = big ? KEY_STEP * 10 : KEY_STEP
          apply({ h: hsv.h, s: clamp(hsv.s + dx * k, 0, 1), v: clamp(hsv.v - dy * k, 0, 1) })
        }}
        onKeyRelease={() => rememberColor(live)}
      >
        <span className={styles.svThumb} style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
      </DragArea>

      <DragArea
        className={styles.hue}
        role="slider"
        aria-label="Teinte"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        onDrag={(x, _y, final) => {
          const next = { ...hsv, h: x * 360 }
          apply(next)
          if (final) rememberColor(hsvToHex(next))
        }}
        onKeyStep={(dx, _dy, big) => apply({ ...hsv, h: clamp(hsv.h + dx * (big ? 10 : 1), 0, 360) })}
        onKeyRelease={() => rememberColor(live)}
      >
        <span className={styles.hueThumb} style={{ left: `${(hsv.h / 360) * 100}%` }} />
      </DragArea>

      <div className={styles.modeRow}>
        <div className={styles.modes} role="tablist" aria-label="Format de couleur">
          {MODES.map(m => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              className={`${styles.mode} ${mode === m.id ? styles.modeActive : ''}`}
              onClick={() => setMode(m.id)}
            >{m.label}</button>
          ))}
        </div>
        {canPickScreen && (
          <button
            type="button"
            className={styles.pipette}
            title="Pipette : prélever une couleur à l'écran"
            aria-label="Pipette : prélever une couleur à l'écran"
            onClick={pickWithEyeDropper}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 7l3 3M4 20l1-4 9.5-9.5a2.1 2.1 0 013 3L8 19l-4 1zM13 6l1.5-1.5a2.1 2.1 0 013 3L16 9" />
            </svg>
          </button>
        )}
      </div>

      <div className={styles.values}>
        {mode === 'hex' && <HexField hex={live} onCommit={applyHex} />}
        {mode === 'rgb' && (
          <>
            {(['r', 'g', 'b'] as const).map(channel => (
              <NumField
                key={channel}
                label={channel.toUpperCase()}
                value={rgb[channel]}
                min={0}
                max={255}
                onChange={v => apply(rgbToHsv({ ...rgb, [channel]: v }))}
                onDone={() => rememberColor(live)}
              />
            ))}
          </>
        )}
        {mode === 'hsl' && (
          <>
            <NumField label="H" value={hsl.h} min={0} max={360}
              onChange={v => apply(hslToHsv({ ...hsl, h: v }))} onDone={() => rememberColor(live)} />
            <NumField label="S" value={hsl.s * 100} min={0} max={100}
              onChange={v => apply(hslToHsv({ ...hsl, s: v / 100 }))} onDone={() => rememberColor(live)} />
            <NumField label="L" value={hsl.l * 100} min={0} max={100}
              onChange={v => apply(hslToHsv({ ...hsl, l: v / 100 }))} onDone={() => rememberColor(live)} />
          </>
        )}
      </div>

      <div className={styles.palette}>
        <div className={styles.sectionHead}>
          <span>Favoris</span>
          <button
            type="button"
            className={styles.addFavorite}
            disabled={isFavorite}
            title={isFavorite ? 'Déjà dans les favoris' : 'Ajouter la couleur actuelle aux favoris'}
            aria-label="Ajouter la couleur actuelle aux favoris"
            onClick={() => pinColor(live)}
          >＋</button>
        </div>
        {favorites.length > 0 ? (
          <SwatchGrid
            colors={favorites}
            current={live}
            onPick={c => applyHex(c, true)}
            actionLabel={c => `Retirer ${c.toUpperCase()} des favoris`}
            actionGlyph="×"
            onAction={unpinColor}
          />
        ) : (
          <p className={styles.empty}>Épinglez vos couleurs avec ＋ ou ★ pour les retrouver ici.</p>
        )}

        {recent.length > 0 && (
          <>
            <div className={styles.sectionHead}><span>Récentes</span></div>
            <SwatchGrid
              colors={recent}
              current={live}
              onPick={c => applyHex(c, true)}
              actionLabel={c => `Ajouter ${c.toUpperCase()} aux favoris`}
              actionGlyph="★"
              onAction={pinColor}
            />
          </>
        )}

        {projectColors.length > 0 && (
          <>
            <div className={styles.sectionHead}><span>Du projet</span></div>
            <SwatchGrid
              colors={projectColors}
              current={live}
              onPick={c => applyHex(c, true)}
              actionLabel={c => `Ajouter ${c.toUpperCase()} aux favoris`}
              actionGlyph="★"
              onAction={pinColor}
            />
          </>
        )}
      </div>
    </div>
  )
}

// ── Champ de couleur (le bouton que l'on voit dans les panneaux) ─────────────

interface Props {
  /** Couleur actuelle en hexadécimal ; vide ou « transparent » = sans couleur. */
  value?: string
  onChange: (hex: string) => void
  /** Nom accessible du champ. */
  label?: string
  /** Pleine largeur avec la valeur écrite (menu contextuel). */
  wide?: boolean
}

export default function ColorPicker({ value, onChange, label = 'Choisir une couleur', wide = false }: Props) {
  const [open, setOpen] = useState(false)
  // Ancrage gardé en état (ref callback) : le lire dans une ref au rendu n'est pas permis.
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const hex = normalizeHex(value)
  const close = useCallback(() => setOpen(false), [])

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        className={`${styles.trigger} ${wide ? styles.wide : ''}`}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span
          className={`${styles.chip} ${hex ? '' : styles.chipNone}`}
          style={hex ? { backgroundColor: hex } : undefined}
        />
        {wide && <span className={styles.triggerText}>{hex ? hex.toUpperCase() : 'transparent'}</span>}
      </button>
      {open && anchor && createPortal(
        <ColorPopover anchor={anchor} hex={hex} onChange={onChange} onClose={close} />,
        document.body,
      )}
    </>
  )
}
