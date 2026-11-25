import { useEffect, useState } from 'react'
import { fontStack } from '../../utils/fonts'
import type { BlockComponentProps, ChartBlockData } from '../../types'
import {
  DEFAULT_CHART_INK, arcPath, clamp01, datumColor, easeProgress, formatValue,
  itemProgress, linePath, niceScale, safeValue,
} from '../../utils/chart'

/**
 * Bloc graphique : colonnes, barres, courbe, aire, camembert ou anneau, dessinés
 * en SVG (aucune bibliothèque). Le rendu est une pure fonction de l'avancement
 * `t` de l'animation, de 0 à 1 :
 * - `present` et `edit` : `t` monte de 0 à 1 à l'arrivée du bloc ;
 * - absent (vignettes, export PowerPoint, couche sortante) : `t` vaut 1, le
 *   graphique est toujours montré terminé.
 */

const GRID_OPACITY = 0.18
/** Largeur moyenne d'un caractère, en multiple de la taille de police. */
const CHAR_WIDTH = 0.58

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Avancement linéaire de l'animation. Ne touche à l'état que depuis le rappel
 * d'image : relancer (clé qui change) repasse donc par 0 au premier rappel.
 */
function useChartProgress(active: boolean, seconds: number, delay: number, replayKey: string): number {
  // L'avancement est rangé avec la clé de la lecture qui l'a produit : après un
  // changement de réglage, l'ancienne valeur (1) ne s'affiche pas le temps d'une image.
  const [state, setState] = useState({ key: replayKey, t: 0 })

  useEffect(() => {
    if (!active) return
    const begin = performance.now() + delay * 1000
    const length = Math.max(0.05, seconds) * 1000
    let frame = 0
    const tick = (now: number) => {
      const progress = clamp01((now - begin) / length)
      setState({ key: replayKey, t: progress })
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, seconds, delay, replayKey])

  if (!active) return 1
  return state.key === replayKey ? state.t : 0
}

function truncate(text: string, maxChars: number): string {
  if (maxChars < 2) return ''
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(1, maxChars - 1))}…`
}

interface DrawProps {
  block: ChartBlockData
  width: number
  height: number
  fs: number
  ink: string
  /** Avancement linéaire global. */
  t: number
}

function geometry(block: ChartBlockData) {
  const values = block.data.map(d => safeValue(d.value))
  return { values, max: Math.max(0, ...values), count: values.length }
}

/** Colonnes, courbe et aire partagent le même repère : axe vertical gradué. */
function VerticalChart({ block, width, height, fs, ink, t }: DrawProps) {
  const { values, max, count } = geometry(block)
  const kind = block.chartKind
  const scale = niceScale(max)
  const unit = block.unit ?? ''
  const showGrid = block.showGrid !== false
  const showLabels = block.showLabels !== false
  const showValues = block.showValues !== false
  const cascade = !!block.cascade

  const axisWidth = showGrid ? formatValue(scale.max, unit).length * fs * CHAR_WIDTH + 10 : 0
  const padL = 12 + axisWidth
  const padR = 14
  const padT = showValues ? fs * 1.8 : 12
  const padB = showLabels ? fs * 2.2 : 12
  const plotW = Math.max(1, width - padL - padR)
  const plotH = Math.max(1, height - padT - padB)
  const base = padT + plotH
  const slot = plotW / count
  const maxChars = Math.floor(slot / (fs * CHAR_WIDTH))

  const ticks: number[] = []
  for (let v = 0; v <= scale.max + scale.step / 2; v += scale.step) ticks.push(v)

  const progress = (i: number) => easeProgress(block.animEase, itemProgress(t, i, count, cascade))
  const centerX = (i: number) => padL + slot * (i + 0.5)
  const topY = (i: number) => base - (values[i] / scale.max) * plotH * progress(i)

  const points = values.map((_, i): [number, number] => [centerX(i), topY(i)])
  const lineColor = datumColor(block, block.data[0], 0)
  const smooth = block.smooth !== false

  return (
    <>
      {showGrid && ticks.map(v => {
        const y = base - (v / scale.max) * plotH
        return (
          <g key={v}>
            <line x1={padL} x2={padL + plotW} y1={y} y2={y} stroke={ink} strokeOpacity={GRID_OPACITY} strokeWidth={1} />
            <text x={padL - 8} y={y + fs * 0.35} textAnchor="end" fontSize={fs * 0.85} fill={ink} fillOpacity={0.7}>
              {formatValue(v, unit)}
            </text>
          </g>
        )
      })}

      {kind === 'column' && values.map((v, i) => {
        const barW = Math.min(slot * 0.62, 90)
        const h = (v / scale.max) * plotH * progress(i)
        const color = datumColor(block, block.data[i], i)
        return (
          <g key={block.data[i].id}>
            <rect
              x={centerX(i) - barW / 2} y={base - Math.max(0, h)} width={barW} height={Math.max(0, h)}
              rx={Math.min(6, barW / 4)} fill={color}
            />
            {showValues && (
              <text
                x={centerX(i)} y={base - Math.max(0, h) - fs * 0.4} textAnchor="middle"
                fontSize={fs} fontWeight={600} fill={ink} fillOpacity={clamp01(progress(i) * 1.5)}
              >
                {formatValue(v * clamp01(progress(i)), unit)}
              </text>
            )}
          </g>
        )
      })}

      {(kind === 'line' || kind === 'area') && count > 0 && (
        <>
          {kind === 'area' && (
            <path
              d={`${linePath(points, smooth)} L ${points[count - 1][0]} ${base} L ${points[0][0]} ${base} Z`}
              fill={lineColor} fillOpacity={0.22}
            />
          )}
          <path d={linePath(points, smooth)} fill="none" stroke={lineColor} strokeWidth={Math.max(2, fs * 0.2)} strokeLinecap="round" strokeLinejoin="round" />
          {points.map(([x, y], i) => (
            <g key={block.data[i].id}>
              <circle cx={x} cy={y} r={Math.max(3, fs * 0.3) * clamp01(progress(i) * 2)} fill={datumColor(block, block.data[i], i)} stroke={lineColor} strokeWidth={2} />
              {showValues && (
                <text x={x} y={y - fs * 0.8} textAnchor="middle" fontSize={fs} fontWeight={600} fill={ink} fillOpacity={clamp01(progress(i) * 1.5)}>
                  {formatValue(values[i] * clamp01(progress(i)), unit)}
                </text>
              )}
            </g>
          ))}
        </>
      )}

      {showLabels && values.map((_, i) => (
        <text key={block.data[i].id} x={centerX(i)} y={base + fs * 1.4} textAnchor="middle" fontSize={fs * 0.9} fill={ink}>
          {truncate(block.data[i].label, maxChars)}
        </text>
      ))}
    </>
  )
}

/** Barres horizontales : étiquettes à gauche, valeurs au bout des barres. */
function HorizontalChart({ block, width, height, fs, ink, t }: DrawProps) {
  const { values, max, count } = geometry(block)
  const scale = niceScale(max)
  const unit = block.unit ?? ''
  const showGrid = block.showGrid !== false
  const showLabels = block.showLabels !== false
  const showValues = block.showValues !== false

  const longest = Math.max(0, ...block.data.map(d => d.label.length))
  const padL = showLabels ? Math.min(width * 0.34, longest * fs * CHAR_WIDTH + 18) : 12
  const padR = showValues ? formatValue(scale.max, unit).length * fs * CHAR_WIDTH + 14 : 14
  const padT = 10
  const padB = showGrid ? fs * 2 : 10
  const plotW = Math.max(1, width - padL - padR)
  const plotH = Math.max(1, height - padT - padB)
  const slot = plotH / count
  const barH = Math.min(slot * 0.62, 56)
  const maxChars = Math.floor((padL - 14) / (fs * CHAR_WIDTH))

  const ticks: number[] = []
  for (let v = 0; v <= scale.max + scale.step / 2; v += scale.step) ticks.push(v)

  return (
    <>
      {showGrid && ticks.map(v => {
        const x = padL + (v / scale.max) * plotW
        return (
          <g key={v}>
            <line x1={x} x2={x} y1={padT} y2={padT + plotH} stroke={ink} strokeOpacity={GRID_OPACITY} strokeWidth={1} />
            <text x={x} y={padT + plotH + fs * 1.3} textAnchor="middle" fontSize={fs * 0.85} fill={ink} fillOpacity={0.7}>
              {formatValue(v, unit)}
            </text>
          </g>
        )
      })}
      {values.map((v, i) => {
        const p = easeProgress(block.animEase, itemProgress(t, i, count, !!block.cascade))
        const w = (v / scale.max) * plotW * p
        const cy = padT + slot * (i + 0.5)
        return (
          <g key={block.data[i].id}>
            <rect x={padL} y={cy - barH / 2} width={Math.max(0, w)} height={barH} rx={Math.min(6, barH / 3)} fill={datumColor(block, block.data[i], i)} />
            {showLabels && (
              <text x={padL - 10} y={cy + fs * 0.35} textAnchor="end" fontSize={fs * 0.95} fill={ink}>
                {truncate(block.data[i].label, maxChars)}
              </text>
            )}
            {showValues && (
              <text x={padL + Math.max(0, w) + 8} y={cy + fs * 0.35} fontSize={fs} fontWeight={600} fill={ink} fillOpacity={clamp01(p * 1.5)}>
                {formatValue(v * clamp01(p), unit)}
              </text>
            )}
          </g>
        )
      })}
    </>
  )
}

/** Camembert et anneau : un balayage horaire depuis midi, légende à droite. */
function RadialChart({ block, width, height, fs, ink, t }: DrawProps) {
  const { values } = geometry(block)
  const total = values.reduce((a, b) => a + b, 0)
  const unit = block.unit ?? ''
  const donut = block.chartKind === 'donut'
  const legend = block.showLegend !== false
  const showValues = block.showValues !== false

  const pad = 14
  const legendWidth = legend ? Math.min(width * 0.42, Math.max(...block.data.map(d => d.label.length), 6) * fs * CHAR_WIDTH + fs * 5) : 0
  const diameter = Math.max(20, Math.min(height - pad * 2, width - legendWidth - pad * (legend ? 3 : 2)))
  const outer = diameter / 2
  const cx = pad + (width - legendWidth - pad * (legend ? 2 : 1)) / 2 + (legend ? 0 : pad / 2)
  const cy = height / 2
  const ringWidth = Math.min(0.9, Math.max(0.2, block.ringWidth ?? 0.45))
  const inner = donut ? outer * (1 - ringWidth) : 0

  const sweep = Math.min(1, easeProgress(block.animEase, t)) * Math.PI * 2
  const before = values.map((_, i) => values.slice(0, i).reduce((a, b) => a + b, 0))
  const slices = values.map((v, i) => {
    const from = (before[i] / total) * sweep
    const to = ((before[i] + v) / total) * sweep
    return { i, d: arcPath(cx, cy, outer, inner, from, to), color: datumColor(block, block.data[i], i) }
  })

  const rowHeight = fs * 1.7
  const rows = Math.max(1, Math.floor((height - pad * 2) / rowHeight))
  const legendX = width - legendWidth - pad + 4
  const legendTop = cy - (Math.min(rows, values.length) * rowHeight) / 2
  const legendChars = Math.floor((legendWidth - fs * 1.6) / (fs * CHAR_WIDTH))

  return (
    <>
      {slices.map(s => s.d && <path key={block.data[s.i].id} d={s.d} fill={s.color} />)}
      {donut && inner > fs * 2 && (
        <text x={cx} y={cy + fs * 0.4} textAnchor="middle" fontSize={Math.min(fs * 2, inner * 0.5)} fontWeight={700} fill={ink}>
          {formatValue(total * clamp01(t), unit)}
        </text>
      )}
      {legend && block.data.slice(0, rows).map((d, i) => {
        const y = legendTop + rowHeight * i + rowHeight / 2
        const share = Math.round((values[i] / total) * 100)
        return (
          <g key={d.id}>
            <circle cx={legendX + fs * 0.4} cy={y} r={fs * 0.4} fill={datumColor(block, d, i)} />
            <text x={legendX + fs * 1.2} y={y + fs * 0.35} fontSize={fs * 0.95} fill={ink}>
              {truncate(d.label, legendChars - (showValues ? 5 : 0))}
              {showValues && <tspan fillOpacity={0.65}>{` ${share} %`}</tspan>}
            </text>
          </g>
        )
      })}
    </>
  )
}

export default function ChartBlock({ block, mode }: BlockComponentProps<ChartBlockData>) {
  const animated = (mode === 'present' || mode === 'edit') && block.animated !== false && !prefersReducedMotion()
  const t = useChartProgress(
    animated,
    block.animSeconds ?? 1.2,
    block.animDelay ?? 0.3,
    `${block.chartKind}|${block.animSeconds}|${block.animDelay}|${block.animEase}|${block.cascade}`,
  )

  const data = Array.isArray(block.data) ? block.data : []
  const width = Math.max(1, block.width)
  const height = Math.max(1, block.height)
  const fs = Math.min(60, Math.max(8, block.fontSize ?? 14))
  const ink = block.textColor ?? DEFAULT_CHART_INK
  const hasValues = data.some(d => safeValue(d.value) > 0)
  const props: DrawProps = { block: { ...block, data }, width, height, fs, ink, t }

  const summary = data.map(d => `${d.label} : ${formatValue(safeValue(d.value), block.unit)}`).join(', ')
  const Chart = block.chartKind === 'bar'
    ? HorizontalChart
    : block.chartKind === 'pie' || block.chartKind === 'donut'
      ? RadialChart
      : VerticalChart

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      boxSizing: 'border-box',
      overflow: 'hidden',
      backgroundColor: block.backgroundColor || undefined,
      borderRadius: block.borderRadius ? `${block.borderRadius}px` : undefined,
    }}>
      <svg
        width="100%" height="100%"
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block', fontFamily: fontStack(block.fontFamily) ?? 'inherit' }}
        role="img"
        aria-label={`Graphique. ${summary}`}
      >
        {hasValues ? <Chart {...props} /> : (
          <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={fs} fill={ink} fillOpacity={0.6}>
            Aucune donnée : ajoutez-en dans l'onglet Contenu
          </text>
        )}
      </svg>
    </div>
  )
}
