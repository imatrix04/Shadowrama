import { useRef, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { BlockData, BlockProperty, AnimationType } from '../../types'
import { getBlockField, setBlockField } from '../../types'
import { getBlockProperties, getBlockConfig } from '../../blocks'
import Icon from '../ui/Icon'
import ColorPicker from '../ui/ColorPicker'
import styles from './ContextMenu.module.css'
import panel from './PanelControls.module.css'
import { Segmented } from './PanelWidgets'
import CustomSelect from '../../styles/CustomSelect'
import PolygonShapeEditor from './PolygonShapeEditor'
import Switch from '../ui/Switch'
import CarouselItemsEditor from './CarouselItemsEditor'
import ChartDataEditor from './ChartDataEditor'
import TableDataEditor from './TableDataEditor'
import type { CarouselItem, ChartDatum } from '../../types'
import { normalizePolygon } from '../../utils/shapePolygon'
import MediaFileField from './MediaFileField'
import { normalizeWebUrl } from '../../utils/webUrl'

// Doivent rester alignés sur les valeurs par défaut de useBlockAnimation.
const DEFAULT_DURATION = 0.6
const DEFAULT_EASE = 'power2.out'

const EASE_OPTIONS = [
  { label: 'Douce (sortie)', value: 'power2.out' },
  { label: 'Douce (entrée/sortie)', value: 'power2.inOut' },
  { label: 'Linéaire', value: 'none' },
  { label: 'Rebond', value: 'back.out(1.7)' },
  { label: 'Élastique', value: 'elastic.out(1, 0.5)' },
]

// Les champs numériques acceptent une saisie vide ou aberrante : on retombe
// sur la valeur par défaut plutôt que d'écrire NaN dans le projet.
function clamp(value: number, min: number, max: number, fallback: number): number {
  if (Number.isNaN(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

interface Props {
  block: BlockData
  x: number
  y: number
  onUpdate: (id: number, changes: Partial<BlockData>) => void
  onDelete: (id: number) => void
  onReorder: (id: number, direction: 'front' | 'back' | 'forward' | 'backward') => void
  /** Ouvre une entrée d'historique avant la première modification d'un champ. */
  onGestureStart: () => void
  onClose: () => void
  /** Position du bloc dans l'empilement (1 = tout en arrière) et taille totale,
   *  pour afficher « Niveau X / Y » et désactiver les boutons déjà à l'extrémité. */
  layerIndex: number
  layerCount: number
}

/**
 * Adresse d'une page web : validée à la validation (Entrée ou sortie du champ),
 * pas à chaque frappe, sinon la page se rechargerait sur « h », « ht », « htt »…
 */
function UrlField({ value, onCommit }: { value: string; onCommit: (url: string) => void }) {
  const [draft, setDraft] = useState(value)
  const [invalid, setInvalid] = useState(false)

  const commit = () => {
    if (!draft.trim()) {
      setInvalid(false)
      if (value) onCommit('')
      return
    }
    const url = normalizeWebUrl(draft)
    if (!url) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setDraft(url)
    if (url !== value) onCommit(url)
  }

  return (
    <input
      type="text"
      className={styles.input}
      style={invalid ? { borderColor: '#ff6b6b' } : undefined}
      value={draft}
      placeholder="localhost:3000, youtube.com…"
      spellCheck={false}
      onChange={e => { setDraft(e.target.value); setInvalid(false) }}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit() }}
    />
  )
}

/** Curseur avec sa valeur dans une pastille, comme dans les panneaux latéraux. */
function SliderField({ value, min, max, step, format, label, onChange }: {
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  label: string
  onChange: (v: number) => void
}) {
  return (
    <div className={panel.rangeGroup} style={{ width: '100%' }}>
      <input
        type="range"
        className={`${panel.range} ${panel.rangeFull}`}
        min={min} max={max} step={step}
        value={Math.min(max, Math.max(min, value))}
        aria-label={label}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
      <output className={panel.sliderValue}>{format(value)}</output>
    </div>
  )
}

// Plages des champs « float » : tous ne vont pas de 0 à 1 (l'interlignage,
// par exemple, dépasse 1 — l'ancien champ le plafonnait à 1).
const FLOAT_RANGES: Record<string, { min: number; max: number; step: number }> = {
  opacity: { min: 0, max: 1, step: 0.05 },
  volume: { min: 0, max: 1, step: 0.05 },
  lineHeight: { min: 0.8, max: 3, step: 0.05 },
}

/** Libellés courts : seuls ces choix passent en boutons segmentés. */
const SEGMENT_MAX_LABEL = 10

function renderField(prop: BlockProperty, block: BlockData, onUpdate: (id: number, changes: Partial<BlockData>) => void) {
  if (prop.key === 'rotation') {
    return (
      <SliderField
        label={prop.label}
        min={-180} max={180} step={1}
        value={Number(getBlockField(block, 'rotation') ?? 0)}
        format={v => `${v}°`}
        onChange={v => onUpdate(block.id, setBlockField(block, 'rotation', v))}
      />
    )
  }
  switch (prop.type) {
    case 'textarea':
      return (
        <textarea
          className={styles.input}
          rows={3}
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
          value={String(getBlockField(block, prop.key) ?? '')}
          onChange={e => onUpdate(block.id, setBlockField(block, prop.key, e.target.value))}
        />
      )
    case 'number':
      return (
        <input
          type="number"
          className={styles.input}
          value={Number(getBlockField(block, prop.key) ?? 0)}
          onChange={e => onUpdate(block.id, setBlockField(block, prop.key, Number(e.target.value)))}
        />
      )
    case 'color':
      // Pleine largeur, valeur écrite ; sans couleur (ou « transparent »), le
      // champ l'indique et la fenêtre démarre sur du blanc.
      return (
        <ColorPicker
          wide
          value={String(getBlockField(block, prop.key) ?? '')}
          onChange={hex => onUpdate(block.id, setBlockField(block, prop.key, hex))}
          label={prop.label}
        />
      )
    case 'url':
      return (
        <UrlField
          value={String(getBlockField(block, prop.key) ?? '')}
          onCommit={url => onUpdate(block.id, setBlockField(block, prop.key, url))}
        />
      )
    case 'text':
      return (
        <input
          type="text"
          className={styles.input}
          value={String(getBlockField(block, prop.key) ?? '')}
          onChange={e => onUpdate(block.id, setBlockField(block, prop.key, e.target.value))}
        />
      )
    case 'select': {
      const options = prop.options ?? []
      const current = String(getBlockField(block, prop.key) ?? '')
      if (options.length >= 2 && options.length <= 3 && options.every(o => o.label.length <= SEGMENT_MAX_LABEL)) {
        return (
          <Segmented
            options={options}
            value={current}
            onChange={v => onUpdate(block.id, setBlockField(block, prop.key, v))}
          />
        )
      }
      return (
        <CustomSelect
          value={String(getBlockField(block, prop.key) ?? '')}
          options={prop.options ?? []}
          onChange={v => onUpdate(block.id, setBlockField(block, prop.key, v))}
        />
      )
    }
    case 'float': {
      const range = FLOAT_RANGES[prop.key] ?? { min: 0, max: 1, step: 0.05 }
      return (
        <SliderField
          label={prop.label}
          {...range}
          value={Number(getBlockField(block, prop.key) ?? 1)}
          format={v => v.toFixed(2)}
          onChange={v => onUpdate(block.id, setBlockField(block, prop.key, v))}
        />
      )
    }
      case 'file':
        return <MediaFileField fieldKey={prop.key} accept={prop.accept} block={block} onUpdate={onUpdate} />
    case 'shapePolygon': {
      // Même conversion que polygonToMaskDataUri : l'éditeur travaille dans un
      // repère abstrait 0–100, le rayon stocké est en pixels réels du bloc.
      const radiusPx = Number(getBlockField(block, 'borderRadius') ?? 0)
      const abstractRadius = radiusPx > 0
        ? (radiusPx * 100) / Math.max(1, Math.min(block.width, block.height))
        : 0
      return (
        <PolygonShapeEditor
          value={normalizePolygon(getBlockField(block, prop.key))}
          radius={abstractRadius}
          onChange={points => onUpdate(block.id, setBlockField(block, prop.key, points))}
        />
      )
    }
    case 'boolean':
      return (
        <Switch
          checked={Boolean(getBlockField(block, prop.key))}
          label={prop.label}
          onChange={v => onUpdate(block.id, setBlockField(block, prop.key, v))}
        />
      )
    case 'carouselItems': {
      const raw = getBlockField(block, prop.key)
      return (
        <CarouselItemsEditor
          items={Array.isArray(raw) ? (raw as CarouselItem[]) : []}
          blockWidth={block.width}
          blockHeight={block.height}
          onChange={items => onUpdate(block.id, setBlockField(block, prop.key, items))}
        />
      )
    }
    case 'chartData': {
      const raw = getBlockField(block, prop.key)
      return (
        <ChartDataEditor
          data={Array.isArray(raw) ? (raw as ChartDatum[]) : []}
          colorMode={getBlockField(block, 'colorMode') as 'palette' | 'single' | undefined}
          accentColor={getBlockField(block, 'accentColor') as string | undefined}
          onChange={data => onUpdate(block.id, setBlockField(block, prop.key, data))}
        />
      )
    }
    case 'tableData': {
      const raw = getBlockField(block, prop.key)
      return (
        <TableDataEditor
          cells={Array.isArray(raw) ? (raw as string[][]) : []}
          headerRow={getBlockField(block, 'headerRow') !== false}
          onChange={cells => onUpdate(block.id, setBlockField(block, prop.key, cells))}
        />
      )
    }
    default:
      return null
  }
}

type TabKey = 'content' | 'style' | 'animation'

const TABS: { key: TabKey; label: string; icon: 'text' | 'effects' | 'motion' }[] = [
  { key: 'content', label: 'Contenu', icon: 'text' },
  { key: 'style', label: 'Style', icon: 'effects' },
  { key: 'animation', label: 'Animation', icon: 'motion' },
]

/** Champs qui portent ce que le bloc MONTRE (texte, fichier, adresse…) ; tout le reste est du réglage. */
const CONTENT_TYPES = new Set<BlockProperty['type']>(['text', 'textarea', 'file', 'url', 'carouselItems', 'chartData', 'tableData'])

// Onglet rouvert à l'identique d'un clic droit à l'autre : on retouche rarement
// un seul champ. Mémoire de session ; sans stockage, on repart du premier onglet.
const TAB_STORAGE_KEY = 'shadowrama.contextMenuTab'

function loadLastTab(): TabKey | null {
  try {
    const value = sessionStorage.getItem(TAB_STORAGE_KEY)
    return TABS.some(t => t.key === value) ? (value as TabKey) : null
  } catch {
    return null
  }
}

const ORDER_ACTIONS = [
  { dir: 'front', label: 'Premier plan', icon: 'layerFront' },
  { dir: 'forward', label: 'Avancer', icon: 'layerForward' },
  { dir: 'backward', label: 'Reculer', icon: 'layerBackward' },
  { dir: 'back', label: 'Arrière-plan', icon: 'layerBack' },
] as const

export default function ContextMenu({ block, x, y, onUpdate, onDelete, onReorder, onGestureStart, onClose, layerIndex, layerCount }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  // Résolues depuis la config du type, pas depuis le bloc : voir BaseBlockData.
  const properties = getBlockProperties(block.type)
    .filter(prop => !prop.showIf || prop.showIf.value.split('|').includes(String(getBlockField(block, prop.showIf.key) ?? '')))
  const config = getBlockConfig(block.type)
  const animation = block.animation
  const hasAnimation = !!animation && animation.type !== 'none'

  const contentProps = properties.filter(p => CONTENT_TYPES.has(p.type))
  const styleProps = properties.filter(p => !CONTENT_TYPES.has(p.type))
  // Un bloc sans contenu à saisir (une forme) n'a pas d'onglet vide.
  const tabs = TABS.filter(t => t.key !== 'content' || contentProps.length > 0)

  const [tab, setTab] = useState<TabKey>(() => {
    const last = loadLastTab()
    return last && tabs.some(t => t.key === last) ? last : tabs[0].key
  })
  const chooseTab = (key: TabKey) => {
    try { sessionStorage.setItem(TAB_STORAGE_KEY, key) } catch { /* mémoire facultative */ }
    setTab(key)
  }

  // Replacé APRÈS chaque changement d'onglet : la hauteur change et le menu
  // pourrait sortir de l'écran.
  useEffect(() => {
    if (!menuRef.current) return
    const { offsetWidth, offsetHeight } = menuRef.current
    const newX = Math.max(8, x + offsetWidth > window.innerWidth ? window.innerWidth - offsetWidth - 8 : x)
    const newY = Math.max(8, y + offsetHeight > window.innerHeight ? window.innerHeight - offsetHeight - 8 : y)
    setPos({ x: newX, y: newY })
  }, [x, y, tab])

  const updateAnimation = (changes: Partial<NonNullable<BlockData['animation']>>) => {
    onUpdate(block.id, setBlockField(block, 'animation', {
      type: animation?.type ?? 'none',
      ...animation,
      ...changes,
    }))
  }

  /** `onPointerDown`/`onFocus` ouvrent l'entrée d'historique avant la première
   *  modification : glisser un curseur ne produit qu'un seul « annuler ». */
  const field = (label: string, control: ReactNode, key: string, inline = false) => (
    <div
      key={key}
      className={`${styles.field} ${inline ? styles.fieldInline : ''}`}
      onPointerDown={onGestureStart}
      onFocus={onGestureStart}
    >
      <label className={styles.fieldLabel}>{label}</label>
      {control}
    </div>
  )

  const renderProps = (list: BlockProperty[]) =>
    list.map(prop => field(prop.label, renderField(prop, block, onUpdate), prop.key, prop.type === 'boolean'))

  return createPortal(
    <>
      <div onClick={onClose} onMouseDown={e => e.stopPropagation()} className={styles.backdrop} />
      <div
        ref={menuRef}
        onWheel={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        className={styles.menu}
        style={{ left: pos.x, top: pos.y }}
        role="dialog"
        aria-label={`Réglages du bloc ${config?.label ?? block.type}`}
      >
        {/* Type du bloc, avec l'icône de la config comme dans la barre latérale. */}
        <p className={styles.typeLabel}>
          {config && <Icon name={config.icon} size={13} />}
          {config?.label ?? block.type}
        </p>

        <div className={styles.tabs} role="tablist">
          {tabs.map(t => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
              onClick={() => chooseTab(t.key)}
            >
              <Icon name={t.icon} size={13} />
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {tab === 'content' && renderProps(contentProps)}

          {tab === 'style' && renderProps(styleProps)}

          {tab === 'animation' && (
            <>
              {field("Entrée", (
                <CustomSelect
                  value={animation?.type ?? 'none'}
                  options={[
                    { label: 'Aucune', value: 'none' },
                    { label: 'Fondu', value: 'fadeIn' },
                    { label: 'Glisse depuis la gauche', value: 'slideInLeft' },
                    { label: 'Glisse depuis la droite', value: 'slideInRight' },
                    { label: 'Glisse depuis le bas', value: 'slideInUp' },
                    { label: 'Zoom', value: 'zoomIn' },
                  ]}
                  onChange={v => updateAnimation({ type: v as AnimationType })}
                />
              ), 'anim-type')}

              {/* Réglages fins : seulement quand une animation est choisie, sinon
                  ils n'ont aucun effet visible. Le délai permet de faire
                  apparaître les blocs d'une diapo en cascade. */}
              {hasAnimation ? (
                <>
                  {field('Durée', (
                    <SliderField
                      label="Durée" min={0.1} max={5} step={0.1}
                      value={animation.duration ?? DEFAULT_DURATION}
                      format={v => `${v.toFixed(1)} s`}
                      onChange={v => updateAnimation({ duration: clamp(v, 0.1, 5, DEFAULT_DURATION) })}
                    />
                  ), 'anim-duration')}
                  {field('Délai avant le début', (
                    <SliderField
                      label="Délai" min={0} max={10} step={0.1}
                      value={animation.delay ?? 0}
                      format={v => `${v.toFixed(1)} s`}
                      onChange={v => updateAnimation({ delay: clamp(v, 0, 10, 0) })}
                    />
                  ), 'anim-delay')}
                  {field('Courbe', (
                    <CustomSelect
                      value={animation.ease ?? DEFAULT_EASE}
                      options={EASE_OPTIONS}
                      onChange={v => updateAnimation({ ease: v })}
                    />
                  ), 'anim-ease')}
                </>
              ) : (
                <p className={styles.hint}>
                  Choisissez une entrée pour régler sa durée et son délai. Le panneau Mouvement, à gauche, propose des séquences plus riches.
                </p>
              )}
            </>
          )}
        </div>

        {/* Barre d'actions fixe : l'ordre et la suppression restent à portée
            quel que soit l'onglet. */}
        <div className={styles.footer}>
          <div className={styles.order} role="group" aria-label="Ordre d'empilement">
            {ORDER_ACTIONS.map(({ dir, label, icon }) => {
              const atTop = dir === 'front' || dir === 'forward'
              const disabled = atTop ? layerIndex === layerCount : layerIndex === 1
              return (
                <button
                  key={dir}
                  type="button"
                  className={styles.iconBtn}
                  title={label}
                  aria-label={label}
                  disabled={disabled}
                  onClick={() => onReorder(block.id, dir)}
                >
                  <Icon name={icon} size={15} />
                </button>
              )
            })}
            <span className={styles.layerBadge} title="Position dans l'empilement (1 = tout en arrière)">
              {layerIndex}/{layerCount}
            </span>
          </div>
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.deleteBtn}`}
            title="Supprimer le bloc"
            aria-label="Supprimer le bloc"
            onClick={() => { onDelete(block.id); onClose() }}
          >
            <Icon name="trash" size={15} />
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}
