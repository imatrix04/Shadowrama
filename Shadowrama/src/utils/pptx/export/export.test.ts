import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import type { BlockData, Slide, SlideNumbering } from '../../../types'
import { DEFAULT_NUMBERING } from '../../numbering'
import { importPptx } from '../import'
import { parseXml } from '../xml'
import { parseColor } from './colors'
import { FALLBACK_DEFAULTS, planExport } from './plan'
import { buildPptx } from './write'
import type { ExportAssets, RasterImage } from './write'

// PNG 1×1 : le contenu importe peu, seul le circuit des fichiers est vérifié.
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
  c => c.charCodeAt(0),
)

const block = (b: Record<string, unknown>): BlockData =>
  ({ x: 0, y: 0, width: 100, height: 50, ...b }) as unknown as BlockData

function assetsFor(plan: ReturnType<typeof planExport>, media: Record<string, Uint8Array> = {}): ExportAssets {
  const rasters = new Map<string, RasterImage>(plan.jobs.map(job => [job.id, { bytes: PNG, mimeType: 'image/png' }]))
  return {
    rasters,
    loadMedia: async key => media[key],
    imageSize: async () => ({ width: 200, height: 100 }),
  }
}

async function exportSlides(
  slides: Slide[], ultra = true, numbering: SlideNumbering = DEFAULT_NUMBERING, media: Record<string, Uint8Array> = {},
) {
  const plan = planExport(slides, ultra)
  const result = await buildPptx(
    slides, numbering, plan, { ultra, defaults: FALLBACK_DEFAULTS, title: 'Essai' }, assetsFor(plan, media),
  )
  const zip = await JSZip.loadAsync(result.data)
  const text = (path: string) => zip.file(path)!.async('string')
  return { plan, ...result, zip, text }
}

describe('parseColor', () => {
  it("lit les notations produites par l'interface", () => {
    expect(parseColor('#fff')).toEqual({ hex: 'FFFFFF', alpha: 1 })
    expect(parseColor('#3B82F6')).toEqual({ hex: '3B82F6', alpha: 1 })
    expect(parseColor('#00000080')?.alpha).toBeCloseTo(0.5, 1)
    expect(parseColor('rgba(255, 0, 0, 0.25)')).toEqual({ hex: 'FF0000', alpha: 0.25 })
  })

  it("rend null pour une variable de thème, que l'appelant remplace par un repli", () => {
    expect(parseColor('var(--accent)')).toBeNull()
  })
})

describe('planExport', () => {
  const slide = (...blocks: BlockData[]): Slide[] => [{ id: 1, blocks }]
  const kinds = (slides: Slide[], ultra = true) => planExport(slides, ultra).slides[0].blocks.map(b => b.plan.kind)

  it('garde en natif le texte, les formes et les images simples', () => {
    expect(kinds(slide(
      block({ id: 1, type: 'text', content: 'a' }),
      block({ id: 2, type: 'shape', shape: 'star', backgroundColor: '#f00' }),
      block({ id: 3, type: 'image', src: 'media/img-1.png' }),
    ))).toEqual(['native', 'native', 'native'])
  })

  it('passe en image ce que PowerPoint ne sait pas représenter', () => {
    const plan = planExport(slide(
      block({ id: 1, type: 'webview', url: 'example.com' }),
      block({ id: 2, type: 'carousel', items: [{ id: 1, src: 'media/img-1.png' }] }),
      block({ id: 3, type: 'text', content: 'flou', effects: { blur: 4 } }),
      block({ id: 4, type: 'image', src: 'media/img-1.webp' }),
      block({ id: 5, type: 'image', src: 'media/img-1.png', shapeMode: 'grid', customShape: [[0, 0], [1, 0], [1, 1]] }),
    ), true)

    expect(plan.slides[0].blocks.map(b => b.plan.kind)).toEqual(['raster', 'raster', 'raster', 'raster', 'raster'])
    expect(plan.jobs.map(j => j.kind)).toEqual(['webview', 'block', 'block', 'block', 'block'])
    const web = plan.slides[0].blocks[0].plan
    expect(web.kind === 'raster' && web.link).toBe('https://example.com/')
  })

  it('ombre et lueur restent natives : PowerPoint les connaît', () => {
    expect(kinds(slide(block({
      id: 1, type: 'shape', shape: 'rectangle', backgroundColor: '#f00',
      effects: { shadow: { x: 4, y: 4, blur: 8, color: '#000' }, glow: { blur: 10, color: '#fff' } },
    })))).toEqual(['native'])
  })

  it('hors mode Ultra, les effets sont ignorés comme au rendu : rien à capturer', () => {
    const slides = slide(block({ id: 1, type: 'text', content: 'flou', effects: { blur: 4 } }))

    expect(kinds(slides, false)).toEqual(['native'])
    expect(planExport(slides, false).jobs).toEqual([])
  })

  it('laisse de côté les blocs vides (aucune image, aucune adresse)', () => {
    expect(kinds(slide(
      block({ id: 1, type: 'image', src: '' }),
      block({ id: 2, type: 'webview', url: '' }),
      block({ id: 3, type: 'video', src: '' }),
      block({ id: 4, type: 'carousel', items: [] }),
    ))).toEqual([])
  })

  it('intègre une vidéo mp4, mais fige un format que PowerPoint ne lit pas', () => {
    const plan = planExport(slide(
      block({ id: 1, type: 'video', src: 'media/vid-1.mp4' }),
      block({ id: 2, type: 'video', src: 'media/vid-2.webm' }),
    ), true)
    const [mp4, webm] = plan.slides[0].blocks.map(b => b.plan)

    expect(mp4.kind === 'raster' && mp4.video).toBe('media/vid-1.mp4')
    expect(webm.kind === 'raster' && webm.video).toBeUndefined()
  })

  it("respecte l'ordre d'empilement", () => {
    const plan = planExport(slide(
      block({ id: 1, type: 'text', content: 'devant', zIndex: 5 }),
      block({ id: 2, type: 'text', content: 'derrière', zIndex: 1 }),
    ), true)

    expect(plan.slides[0].blocks.map(b => b.block.id)).toEqual([2, 1])
  })

  describe('fond', () => {
    const bg = (background: Slide['background'], ultra = true) =>
      planExport([{ id: 1, blocks: [], background }], ultra).slides[0].background

    it('couleur et dégradé restent natifs', () => {
      expect(bg({ type: 'color', color: '#112233' })).toEqual({ kind: 'solid', color: { hex: '112233', alpha: 1 } })
      expect(bg({ type: 'gradient', gradient: { from: '#000000', to: '#ffffff', angle: 90 } }).kind).toBe('gradient')
    })

    it('image et particules sont capturées', () => {
      expect(bg({ type: 'image', image: 'media/img-1.png' }).kind).toBe('raster')
      expect(bg({
        type: 'color', color: '#000000',
        particles: { enabled: true, count: 50 } as NonNullable<Slide['background']>['particles'],
      }).kind).toBe('raster')
    })

    it('hors mode Ultra, dégradé, image et particules sont inertes : fond par défaut', () => {
      const fallback = { kind: 'solid', color: { hex: 'FAF6EC', alpha: 1 } }
      expect(bg({ type: 'gradient', gradient: { from: '#000', to: '#fff', angle: 0 } }, false)).toEqual(fallback)
      expect(bg({ type: 'image', image: 'media/img-1.png' }, false)).toEqual(fallback)
    })

    it('fond le voile dans les couleurs du dégradé', () => {
      const plan = bg({
        type: 'gradient', gradient: { from: '#ffffff', to: '#ffffff', angle: 0 },
        overlay: { color: '#000000', opacity: 0.5 },
      })
      expect(plan.kind === 'gradient' && plan.from.hex).toBe('808080')
    })
  })
})

describe('buildPptx', () => {
  const sample: Slide[] = [
    {
      id: 1,
      background: { type: 'color', color: '#101020' },
      transition: { preset: 'fade' },
      blocks: [
        block({ id: 1, type: 'title', content: 'Bonjour & <bienvenue>', x: 100, y: 40, width: 760, height: 80, fontSize: 48, fontWeight: 'bold', color: '#ffffff' }),
        block({ id: 2, type: 'text', content: 'Ligne une\nLigne deux', x: 100, y: 160, width: 400, height: 90, textAlign: 'left', color: '#cccccc' }),
        block({ id: 3, type: 'shape', shape: 'rectangle', backgroundColor: '#3b82f6', x: 600, y: 200, width: 200, height: 120, borderRadius: 12, rotation: 15 }),
        block({ id: 4, type: 'shape', shape: 'star', backgroundColor: '#ffcc00', x: 620, y: 360, width: 120, height: 120, borderWidth: 3, borderColor: '#ffffff' }),
        block({ id: 5, type: 'image', src: 'media/img-1.png', x: 60, y: 300, width: 300, height: 200 }),
      ],
    },
    {
      id: 2,
      blocks: [
        block({ id: 6, type: 'webview', url: 'https://example.com/a?b=1&c=2', x: 80, y: 60, width: 800, height: 420 }),
        block({ id: 7, type: 'video', src: 'media/vid-1.mp4', x: 0, y: 0, width: 320, height: 180 }),
      ],
    },
  ]
  const media = { 'media/img-1.png': PNG, 'media/vid-1.mp4': new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]) }

  it('produit un paquet dont chaque partie est du XML valide et déclarée', async () => {
    const { zip, text } = await exportSlides(sample, true, DEFAULT_NUMBERING, media)

    for (const path of Object.keys(zip.files).filter(p => /\.(xml|rels)$/.test(p))) {
      const content = await text(path)
      expect(() => parseXml(content), path).not.toThrow()
    }
    const types = await text('[Content_Types].xml')
    expect(types).toContain('/ppt/slides/slide1.xml')
    expect(types).toContain('/ppt/slides/slide2.xml')
    expect(types).toContain('Extension="png"')
    expect(types).toContain('Extension="mp4"')
  })

  it('ne référence que des fichiers présents dans le paquet', async () => {
    const { zip, text } = await exportSlides(sample, true, DEFAULT_NUMBERING, media)

    for (const path of Object.keys(zip.files).filter(p => p.endsWith('.rels'))) {
      const base = path.replace(/_rels\/[^/]+$/, '')
      for (const rel of Array.from(parseXml(await text(path)).children)) {
        if (rel.getAttribute('TargetMode') === 'External') continue
        const resolved: string[] = []
        for (const part of (base + rel.getAttribute('Target')!).split('/')) {
          if (part === '..') resolved.pop()
          else if (part) resolved.push(part)
        }
        expect(zip.file(resolved.join('/')), `${path} → ${rel.getAttribute('Target')}`).not.toBeNull()
      }
    }
  })

  it("se relit avec l'import : texte, formes et images reviennent à leur place", async () => {
    const { data } = await exportSlides(sample, true, DEFAULT_NUMBERING, media)

    const back = await importPptx(data)
    expect(back.slides).toHaveLength(2)

    const [first] = back.slides
    expect(first.background).toMatchObject({ type: 'color', color: '#101020' })
    expect(first.transition?.preset).toBe('fade')

    type Textual = BlockData & { content: string; fontSize: number }
    const find = (needle: string) =>
      first.blocks.find(b => (b as { content?: string }).content?.includes(needle)) as Textual
    const title = find('Bonjour')
    expect(title.content).toBe('Bonjour & <bienvenue>')
    expect(title.fontSize).toBe(48)
    expect(Math.round(title.x)).toBe(100)
    expect(Math.round(title.width)).toBe(760)
    expect(find('Ligne').content).toBe('Ligne une\nLigne deux')

    const shapes = first.blocks.filter(b => b.type === 'shape')
    expect(shapes).toHaveLength(2)
    expect(shapes[0]).toMatchObject({ rotation: 15 })
    expect(first.blocks.filter(b => b.type === 'image')).toHaveLength(1)

    // Page web et vidéo : deux images (la capture et l'affiche).
    expect(back.slides[1].blocks.filter(b => b.type === 'image')).toHaveLength(2)
  })

  it('rend la page web cliquable et intègre la vidéo', async () => {
    const { text, zip } = await exportSlides(sample, true, DEFAULT_NUMBERING, media)

    const rels = await text('ppt/slides/_rels/slide2.xml.rels')
    expect(rels).toContain('Target="https://example.com/a?b=1&amp;c=2" TargetMode="External"')
    expect(rels).toContain('relationships/video')
    expect(await text('ppt/slides/slide2.xml')).toContain('<a:videoFile')
    expect(Object.keys(zip.files).some(p => /^ppt\/media\/.*\.mp4$/.test(p))).toBe(true)
  })

  it("n'écrit qu'une fois un média posé plusieurs fois", async () => {
    const twice: Slide[] = [{
      id: 1,
      blocks: [
        block({ id: 1, type: 'image', src: 'media/img-1.png' }),
        block({ id: 2, type: 'image', src: 'media/img-1.png', x: 200 }),
      ],
    }]
    const { zip } = await exportSlides(twice, true, DEFAULT_NUMBERING, media)

    expect(Object.keys(zip.files).filter(p => p.startsWith('ppt/media/') && !zip.files[p].dir)).toHaveLength(1)
  })

  it('compte ce qui reste modifiable et ce qui devient image', async () => {
    const { report } = await exportSlides(sample, true, DEFAULT_NUMBERING, media)

    // 5 natifs sur la première diapo + la vidéo ; la page web est une image.
    expect(report).toMatchObject({ slideCount: 2, editableCount: 6, imageCount: 1 })
    expect(report.issues.some(i => i.slide === 2 && i.message.includes('Page web'))).toBe(true)
  })

  it('signale un média absent au lieu de produire un fichier cassé', async () => {
    const { report, text } = await exportSlides(sample, true, DEFAULT_NUMBERING, {})

    expect(report.issues.some(i => i.message.includes('Image introuvable'))).toBe(true)
    expect(await text('ppt/slides/slide1.xml')).not.toContain('<p:pic>')
  })

  it('pose le numéro de diapositive, sauf sur la première si demandé', async () => {
    const numbering: SlideNumbering = { ...DEFAULT_NUMBERING, enabled: true, skipFirst: true, format: 'n-total' }
    const { text } = await exportSlides(sample, true, numbering, media)

    expect(await text('ppt/slides/slide1.xml')).not.toContain('Numéro de diapositive')
    expect(await text('ppt/slides/slide2.xml')).toContain('<a:t>2 / 2</a:t>')
  })

  it('retire les caractères de contrôle, interdits en XML', async () => {
    const slides: Slide[] = [{ id: 1, blocks: [block({ id: 1, type: 'text', content: 'a\u0001b\u000Bc' })] }]
    const { text } = await exportSlides(slides)

    expect(await text('ppt/slides/slide1.xml')).toContain('<a:t>abc</a:t>')
  })
})
