import type { BlockData, TextBlockData, TitleBlockData } from '../../types'
import { nextId } from '../ids'
import { attr, boolAttr, kid, kids, numAttr, path } from './xml'
import { readSolid } from './theme'
import type { ColorValue, ThemeContext } from './theme'
import { EMU_PER_PT, PAD_X, PAD_Y, SINGLE_LINE, r1 } from './context'
import type { Ctx, Box } from './context'
import { normalizePhType } from './parts'
import type { PhInfo } from './parts'
import { readGradient } from './fills'

/**
 * Texte : héritage des styles de caractère et de paragraphe, puis émission des blocs.
 */

// ── Style de texte ───────────────────────────────────────────────────────────

export interface RunProps {
  sz?: number
  b?: boolean
  i?: boolean
  cap?: string
  spc?: number
  color?: ColorValue
  font?: string
}

export interface ParaProps {
  algn?: string
  lnPct?: number
  lnPts?: number
  spcBefPts?: number
  spcBefPct?: number
  spcAftPts?: number
  spcAftPct?: number
  bu?: 'none' | 'char' | 'auto'
  buChar?: string
  run: RunProps
}

export function parseRPr(el: Element | null | undefined, theme: ThemeContext): RunProps {
  if (!el) return {}
  const out: RunProps = {}
  const sz = numAttr(el, 'sz')
  if (sz !== undefined) out.sz = sz
  const b = boolAttr(el, 'b')
  if (b !== undefined) out.b = b
  const i = boolAttr(el, 'i')
  if (i !== undefined) out.i = i
  const cap = attr(el, 'cap')
  if (cap) out.cap = cap
  const spc = numAttr(el, 'spc')
  if (spc !== undefined) out.spc = spc

  const solid = kid(el, 'solidFill')
  if (solid) {
    out.color = readSolid(solid, theme)
  } else {
    const grad = kid(el, 'gradFill')
    if (grad) {
      const g = readGradient(grad, theme)
      if (g.kind === 'gradient') out.color = g.from
    }
  }

  const latin = attr(kid(el, 'latin'), 'typeface')
  if (latin) {
    out.font = latin === '+mj-lt' ? theme.majorFont : latin === '+mn-lt' ? theme.minorFont : latin
  }
  return out
}

export function parsePPr(el: Element | null | undefined, theme: ThemeContext): ParaProps {
  const out: ParaProps = { run: {} }
  if (!el) return out
  const algn = attr(el, 'algn')
  if (algn) out.algn = algn

  const ln = kid(el, 'lnSpc')
  if (ln) {
    const pct = numAttr(kid(ln, 'spcPct'), 'val')
    const pts = numAttr(kid(ln, 'spcPts'), 'val')
    if (pct !== undefined) out.lnPct = pct
    if (pts !== undefined) out.lnPts = pts
  }
  const bef = kid(el, 'spcBef')
  if (bef) {
    out.spcBefPts = numAttr(kid(bef, 'spcPts'), 'val')
    out.spcBefPct = numAttr(kid(bef, 'spcPct'), 'val')
  }
  const aft = kid(el, 'spcAft')
  if (aft) {
    out.spcAftPts = numAttr(kid(aft, 'spcPts'), 'val')
    out.spcAftPct = numAttr(kid(aft, 'spcPct'), 'val')
  }

  if (kid(el, 'buNone')) out.bu = 'none'
  const buChar = kid(el, 'buChar')
  if (buChar) {
    out.bu = 'char'
    out.buChar = attr(buChar, 'char') ?? '•'
  }
  if (kid(el, 'buAutoNum')) out.bu = 'auto'

  out.run = parseRPr(kid(el, 'defRPr'), theme)
  return out
}

export function mergeRun(base: RunProps, over: RunProps): RunProps {
  const out: RunProps = { ...base }
  for (const key of Object.keys(over) as (keyof RunProps)[]) {
    if (over[key] !== undefined) (out as Record<string, unknown>)[key] = over[key]
  }
  return out
}

export function mergePara(base: ParaProps, over: ParaProps): ParaProps {
  const out: ParaProps = { ...base, run: mergeRun(base.run, over.run) }
  for (const key of Object.keys(over) as (keyof ParaProps)[]) {
    if (key === 'run') continue
    if (over[key] !== undefined) (out as unknown as Record<string, unknown>)[key] = over[key]
  }
  return out
}

// ── Texte ────────────────────────────────────────────────────────────────────

export interface TextStyle {
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
  align: 'left' | 'center' | 'right'
  lineHeight: number
  letterSpacing: number
}

export interface ParaOut {
  text: string
  style: TextStyle
  /** Pixels. */
  before: number
  after: number
}

export function alignOf(algn: string | undefined): TextStyle['align'] {
  if (algn === 'ctr') return 'center'
  if (algn === 'r') return 'right'
  return 'left'
}

export function estimateLines(text: string, width: number, fontSize: number, letterSpacing: number): number {
  const charWidth = fontSize * 0.52 + letterSpacing
  let lines = 0
  for (const line of text.split('\n')) {
    lines += Math.max(1, Math.ceil((line.length * charWidth) / Math.max(1, width)))
  }
  return lines
}

export interface TextEnv {
  sp: Element
  ph: PhInfo | null
  phLayout: Element | null
  phMaster: Element | null
}

export function styleContainers(env: TextEnv, ctx: Ctx): (Element | null)[] {
  const list: (Element | null)[] = [ctx.presDefault]
  if (env.ph) {
    const kind = normalizePhType(env.ph.type)
    const txStyles = path(ctx.master?.root, 'txStyles')
    const style = kind === 'title' ? 'titleStyle' : kind === 'body' ? 'bodyStyle' : 'otherStyle'
    list.push(kid(txStyles, style))
    list.push(path(env.phMaster, 'txBody', 'lstStyle'))
    list.push(path(env.phLayout, 'txBody', 'lstStyle'))
  }
  list.push(path(env.sp, 'txBody', 'lstStyle'))
  return list
}

export function bodyPrValue(env: TextEnv, name: string): string | undefined {
  return attr(path(env.sp, 'txBody', 'bodyPr'), name)
    ?? attr(path(env.phLayout, 'txBody', 'bodyPr'), name)
    ?? attr(path(env.phMaster, 'txBody', 'bodyPr'), name)
}

export function emitText(
  env: TextEnv, box: Box, rotation: number | undefined, ctx: Ctx, blocks: BlockData[],
) {
  const body = kid(env.sp, 'txBody')
  if (!body) return
  const paragraphs = kids(body, 'p')
  const pxPerPt = ctx.frame.k * EMU_PER_PT

  const bodyPr = kid(body, 'bodyPr')
  const autofit = kid(bodyPr, 'normAutofit')
  const fontScale = (numAttr(autofit, 'fontScale') ?? 100000) / 100000

  const inset = (name: string, fallback: number) => {
    const v = Number(bodyPrValue(env, name))
    return (Number.isFinite(v) && bodyPrValue(env, name) !== undefined ? v : fallback) * ctx.frame.k
  }
  const left = inset('lIns', 91440)
  const right = inset('rIns', 91440)
  const top = inset('tIns', 45720)
  const bottom = inset('bIns', 45720)

  const anchor = bodyPrValue(env, 'anchor')
  const verticalAlign: 'top' | 'middle' | 'bottom' = anchor === 'ctr' ? 'middle' : anchor === 'b' ? 'bottom' : 'top'

  const containers = styleContainers(env, ctx)
  const out: ParaOut[] = []
  let mixed = false
  let autoNum = 0

  for (const p of paragraphs) {
    const pPr = kid(p, 'pPr')
    const lvl = Math.min(8, Math.max(0, numAttr(pPr, 'lvl') ?? 0))
    let props: ParaProps = { run: {} }
    for (const c of containers) props = mergePara(props, parsePPr(kid(c, `lvl${lvl + 1}pPr`), ctx.theme))
    props = mergePara(props, parsePPr(pPr, ctx.theme))

    interface Piece { text: string; run: RunProps }
    const pieces: Piece[] = []
    for (const child of kids(p)) {
      if (child.localName === 'r' || child.localName === 'fld') {
        const run = mergeRun(props.run, parseRPr(kid(child, 'rPr'), ctx.theme))
        let text = kid(child, 't')?.textContent ?? ''
        if (run.cap === 'all') text = text.toUpperCase()
        pieces.push({ text, run })
        if (run.font) ctx.report.fonts.add(run.font)
      } else if (child.localName === 'br') {
        pieces.push({ text: '\n', run: props.run })
      }
    }

    const text = pieces.map(x => x.text).join('')
    const visible = pieces.filter(x => x.text.trim() !== '')
    // Le style retenu est celui qui porte le plus de caractères.
    let dominant = props.run
    let best = -1
    for (const piece of visible) {
      if (piece.text.length > best) {
        best = piece.text.length
        dominant = piece.run
      }
    }
    if (visible.length === 0) {
      dominant = mergeRun(props.run, parseRPr(kid(p, 'endParaRPr'), ctx.theme))
    }
    if (visible.some(x => x.run.sz !== dominant.sz || x.run.b !== dominant.b || x.run.i !== dominant.i
      || x.run.color?.hex !== dominant.color?.hex)) {
      mixed = true
    }

    const fontPx = Math.max(1, r1(((dominant.sz ?? 1800) / 100) * pxPerPt * fontScale))
    let lineHeight = SINGLE_LINE
    if (props.lnPts !== undefined) lineHeight = (props.lnPts / 100) * pxPerPt / fontPx
    else if (props.lnPct !== undefined) lineHeight = (props.lnPct / 100000) * SINGLE_LINE
    lineHeight = Math.min(3, Math.max(0.8, Math.round(lineHeight * 100) / 100))

    // Puces : un préfixe de texte, faute de vraie liste dans les blocs.
    let prefix = ''
    if (props.bu === 'char' && visible.length > 0) {
      prefix = `${props.buChar ?? '•'} `
      autoNum = 0
    } else if (props.bu === 'auto' && visible.length > 0) {
      autoNum += 1
      prefix = `${autoNum}. `
    } else {
      autoNum = 0
    }

    const spacing = (pts?: number, pct?: number) =>
      pts !== undefined ? (pts / 100) * pxPerPt : pct !== undefined ? (pct / 100000) * fontPx * SINGLE_LINE : 0

    out.push({
      text: prefix + text,
      style: {
        fontSize: fontPx,
        color: dominant.color?.hex ?? '#000000',
        bold: dominant.b ?? false,
        italic: dominant.i ?? false,
        align: alignOf(props.algn),
        lineHeight,
        letterSpacing: dominant.spc !== undefined ? r1((dominant.spc / 100) * pxPerPt) : 0,
      },
      before: spacing(props.spcBefPts, props.spcBefPct),
      after: spacing(props.spcAftPts, props.spcAftPct),
    })
  }

  // Rien de lisible : ni bloc ni bruit.
  if (out.every(p => p.text.trim() === '')) return
  // Les paragraphes vides en tête et en queue décaleraient le texte pour rien.
  while (out.length > 0 && out[0].text.trim() === '') out.shift()
  while (out.length > 0 && out[out.length - 1].text.trim() === '') out.pop()

  if (mixed) ctx.report.add(ctx.slideNo, 'Texte à mise en forme mixte (tailles, couleurs, gras…) : le style dominant est appliqué.')

  // Regroupe les paragraphes consécutifs de même style : un seul bloc suffit.
  interface Group { style: TextStyle; lines: string[]; gap: number }
  const groups: Group[] = []
  for (const [i, para] of out.entries()) {
    const key = JSON.stringify(para.style)
    const last = groups[groups.length - 1]
    const prevAfter = i > 0 ? out[i - 1].after : 0
    if (last && JSON.stringify(last.style) === key && para.before === 0 && prevAfter === 0) {
      last.lines.push(para.text)
    } else {
      groups.push({ style: para.style, lines: [para.text], gap: last ? prevAfter + para.before : 0 })
    }
  }

  const title = env.ph ? normalizePhType(env.ph.type) === 'title' : false
  const make = (g: Group, rect: Box, v: 'top' | 'middle' | 'bottom', rot: number | undefined): BlockData => {
    const common = {
      id: nextId(),
      x: r1(rect.x), y: r1(rect.y), width: Math.max(20, r1(rect.w)), height: Math.max(20, r1(rect.h)),
      content: g.lines.join('\n'),
      fontSize: g.style.fontSize,
      color: g.style.color,
      textAlign: g.style.align,
      verticalAlign: v,
      fontWeight: g.style.bold ? 'bold' as const : 'normal' as const,
      fontStyle: g.style.italic ? 'italic' as const : 'normal' as const,
      lineHeight: g.style.lineHeight,
      letterSpacing: g.style.letterSpacing,
      ...(rot ? { rotation: r1(rot) } : {}),
    }
    return title
      ? ({ type: 'title', ...common } as TitleBlockData)
      : ({ type: 'text', ...common } as TextBlockData)
  }

  const inner: Box = {
    x: box.x + left - PAD_X,
    y: box.y + top - PAD_Y,
    w: box.w - left - right + 2 * PAD_X,
    h: box.h - top - bottom + 2 * PAD_Y,
  }

  if (groups.length === 1) {
    blocks.push(make(groups[0], inner, verticalAlign, rotation))
    return
  }

  // Plusieurs styles : un bloc par groupe, empilés selon une hauteur estimée.
  if (rotation) ctx.report.add(ctx.slideNo, 'Texte pivoté à plusieurs styles : la rotation n\'est pas conservée.')
  const textWidth = Math.max(1, box.w - left - right)
  const heights = groups.map(g => estimateLines(g.lines.join('\n'), textWidth, g.style.fontSize, g.style.letterSpacing)
    * g.style.fontSize * g.style.lineHeight)
  const total = heights.reduce((a, b) => a + b, 0) + groups.reduce((a, g) => a + g.gap, 0)
  const available = box.h - top - bottom
  let cursor = box.y + top
  if (verticalAlign === 'middle') cursor = box.y + top + (available - total) / 2
  else if (verticalAlign === 'bottom') cursor = box.y + top + available - total

  groups.forEach((g, i) => {
    cursor += g.gap
    blocks.push(make(g, { x: inner.x, y: cursor - PAD_Y, w: inner.w, h: heights[i] + 2 * PAD_Y }, 'top', undefined))
    cursor += heights[i]
  })
}
