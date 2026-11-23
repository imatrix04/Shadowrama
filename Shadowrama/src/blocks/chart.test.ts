import { describe, expect, it } from 'vitest'
import { BLOCKS_REGISTRY, getBlockConfig, getBlockProperties, isKnownBlockType } from './index'
import { parseManifestSlides } from '../utils/fileManager'
import { arcPath, easeProgress, formatValue, itemProgress, linePath, niceScale, normalizeChartData } from '../utils/chart'
import { executeTool } from '../ai/tools'
import type { ChartBlockData, Slide } from '../types'

const manifest = (blocks: unknown[]) => JSON.stringify({ version: 2, slides: [{ id: 1, blocks }] })
const chart = (extra: Record<string, unknown>) =>
  parseManifestSlides(manifest([{ id: 5, type: 'chart', x: 0, y: 0, width: 500, height: 300, ...extra }]))[0].blocks[0] as ChartBlockData

describe('bloc graphique : enregistrement', () => {
  it('est une fonctionnalité bêta, pas un bloc réservé à Ultra', () => {
    expect(getBlockConfig('chart')?.beta).toBe('chart')
    expect(getBlockConfig('video')?.beta).toBeUndefined()
  })

  it('est un type connu, sans mode Ultra requis', () => {
    expect(isKnownBlockType('chart')).toBe(true)
    expect(getBlockConfig('chart')?.label).toBe('Graphique')
    expect(getBlockConfig('chart')?.ultraOnly).toBeFalsy()
    expect(BLOCKS_REGISTRY.chart).toBeTypeOf('function')
  })

  it('donne à chaque nouveau graphique ses propres identifiants de données', () => {
    const a = getBlockConfig('chart')!.defaultProps as Partial<ChartBlockData>
    const b = getBlockConfig('chart')!.defaultProps as Partial<ChartBlockData>
    const ids = [...a.data!, ...b.data!].map(d => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('expose les réglages communs et ceux d’animation', () => {
    const keys = getBlockProperties('chart').map(p => p.key)
    for (const key of ['data', 'chartKind', 'animated', 'animSeconds', 'cascade', 'opacity', 'rotation']) {
      expect(keys).toContain(key)
    }
  })
})

describe('bloc graphique : ouverture d’un projet', () => {
  it('garde des données exploitables même si le fichier est abîmé', () => {
    expect(chart({ data: 'nope' }).data).toHaveLength(1)
    const data = chart({ data: [{ label: 'A', value: -4 }, { label: 7, value: 'x' }, null] }).data
    expect(data).toHaveLength(2)
    expect(data.map(d => d.value)).toEqual([0, 0])
    expect(data.every(d => typeof d.id === 'number' && typeof d.label === 'string')).toBe(true)
  })

  it('conserve les données valides', () => {
    expect(chart({ data: [{ id: 1, label: 'T1', value: 12.5, color: '#fff' }] }).data)
      .toEqual([{ id: 1, label: 'T1', value: 12.5, color: '#fff' }])
  })
})

describe('utilitaires du graphique', () => {
  it('gradue l’axe en nombres ronds', () => {
    expect(niceScale(78)).toEqual({ max: 80, step: 20 })
    expect(niceScale(100)).toEqual({ max: 100, step: 25 })
    expect(niceScale(0).max).toBeGreaterThan(0)
  })

  it('anime de 0 à 1, avec ou sans cascade', () => {
    for (const kind of ['smooth', 'bounce', 'linear'] as const) {
      expect(easeProgress(kind, 0)).toBeCloseTo(0)
      expect(easeProgress(kind, 1)).toBeCloseTo(1)
    }
    expect(itemProgress(0.5, 3, 4, false)).toBe(0.5)
    expect(itemProgress(0, 3, 4, true)).toBe(0)
    expect(itemProgress(1, 3, 4, true)).toBe(1)
    // La cascade fait démarrer les dernières données plus tard.
    expect(itemProgress(0.5, 3, 4, true)).toBeLessThan(itemProgress(0.5, 0, 4, true))
  })

  it('formate à la française, avec l’unité', () => {
    expect(formatValue(42, '%')).toBe('42%')
    expect(formatValue(1200, 'k€')).toMatch(/^1\s?200 k€$/)
    expect(formatValue(3.14159)).toBe('3,1')
  })

  it('trace des chemins valides', () => {
    expect(linePath([], true)).toBe('')
    expect(linePath([[0, 0], [10, 10]], false)).toBe('M 0 0 L 10 10')
    expect(linePath([[0, 0], [10, 10], [20, 0]], true)).toContain('C')
    expect(arcPath(50, 50, 40, 0, 0, 0)).toBe('')
    expect(arcPath(50, 50, 40, 20, 0, Math.PI * 2)).toMatch(/^M .* Z$/)
  })

  it('borne le nombre de données', () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ label: String(i), value: i }))
    expect(normalizeChartData(many, () => 1)).toHaveLength(24)
  })
})

describe('assistant : bloc graphique', () => {
  const blank = (): Slide[] => [{ id: 1, blocks: [] }]

  it('crée un graphique avec ses données validées', () => {
    const out = executeTool(blank(), 'add_block', {
      slide: 1, type: 'chart',
      props: { chartKind: 'donut', unit: '%', data: [{ label: 'A', value: 60 }, { label: 'B', value: 40, color: '#ff0000' }] },
    }, { ultra: false, features: { chart: true } })
    expect(out.isError, out.result).toBe(false)
    const block = out.slides[0].blocks[0] as ChartBlockData
    expect(block.chartKind).toBe('donut')
    expect(block.data.map(d => d.value)).toEqual([60, 40])
    expect(block.animated).toBe(true)
  })

  it('refuse le bloc tant que la fonctionnalité bêta est désactivée', () => {
    const slides = blank()
    for (const ctx of [{ ultra: false }, { ultra: true, features: { chart: false } }]) {
      const out = executeTool(slides, 'add_block', { slide: 1, type: 'chart' }, ctx)
      expect(out.isError).toBe(true)
      expect(out.result).toMatch(/bêta/)
      expect(out.slides).toBe(slides)
    }
  })

  it('ne le liste dans get_reference que si la fonctionnalité est activée', () => {
    const types = (features?: { chart: boolean }) =>
      (JSON.parse(executeTool(blank(), 'get_reference', {}, { ultra: false, features }).result).blocks as { type: string }[]).map(b => b.type)
    expect(types()).not.toContain('chart')
    expect(types({ chart: true })).toContain('chart')
  })

  it('refuse des données invalides sans rien modifier', () => {
    const slides = blank()
    for (const data of [[], 'x', [{ label: 'A' }], [{ value: 3 }], [{ label: 'A', value: 1, color: 'rouge' }]]) {
      const out = executeTool(slides, 'add_block', { slide: 1, type: 'chart', props: { data } }, { ultra: false, features: { chart: true } })
      expect(out.isError, JSON.stringify(data)).toBe(true)
      expect(out.slides).toBe(slides)
    }
    expect(executeTool(slides, 'add_block', { slide: 1, type: 'chart', props: { chartKind: 'radar' } }, { ultra: false, features: { chart: true } }).isError).toBe(true)
  })
})
