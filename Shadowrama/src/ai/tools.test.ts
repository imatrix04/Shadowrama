import { describe, expect, it } from 'vitest'
import type { Slide } from '../types'
import { executeTool } from './tools'
import type { Attachment } from './types'

const basic = { ultra: false }
const ultra = { ultra: true }
const blank = (): Slide[] => [{ id: 1, blocks: [] }]

/** Applique une suite d'outils et renvoie l'état final ; échoue si l'un d'eux échoue. */
function apply(slides: Slide[], name: string, input: unknown, ctx = basic) {
  const out = executeTool(slides, name, input, ctx)
  expect(out.isError, out.result).toBe(false)
  return out
}

describe('executeTool — lecture', () => {
  it('ne modifie jamais les diapositives', () => {
    const slides = blank()
    for (const name of ['get_reference', 'get_project']) {
      expect(executeTool(slides, name, {}, basic).slides).toBe(slides)
    }
    expect(executeTool(slides, 'get_slide', { slide: 1 }, basic).slides).toBe(slides)
  })

  it('masque les blocs et options réservés à Ultra hors du mode Ultra', () => {
    const basicRef = JSON.parse(executeTool(blank(), 'get_reference', {}, basic).result)
    const ultraRef = JSON.parse(executeTool(blank(), 'get_reference', {}, ultra).result)
    expect(basicRef.blocks.map((b: { type: string }) => b.type)).not.toContain('webview')
    expect(ultraRef.blocks.map((b: { type: string }) => b.type)).toContain('webview')
    // Image et vidéo : blocs créables (vides). Le carrousel exige Ultra.
    expect(basicRef.blocks.map((b: { type: string }) => b.type)).toEqual(expect.arrayContaining(['image', 'video']))
    expect(basicRef.blocks.map((b: { type: string }) => b.type)).not.toContain('carousel')
    expect(ultraRef.blocks.map((b: { type: string }) => b.type)).toContain('carousel')
  })

  it('ne divulgue pas les clés média', () => {
    const slides: Slide[] = [{
      id: 1,
      blocks: [{ id: 5, type: 'image', x: 0, y: 0, width: 100, height: 100, src: 'media/secret.png' }],
    }]
    const out = executeTool(slides, 'get_slide', { slide: 1 }, basic)
    expect(out.result).not.toContain('secret.png')
  })
})

describe('executeTool — blocs', () => {
  it('ajoute un titre validé avec ses propriétés', () => {
    const out = apply(blank(), 'add_block', {
      slide: 1, type: 'title',
      props: { content: 'Bonjour', x: 80, y: 60, width: 800, height: 80, color: '#ffffff', fontSize: 48 },
    })
    const block = out.slides[0].blocks[0]
    expect(block).toMatchObject({ type: 'title', content: 'Bonjour', x: 80, fontSize: 48 })
    expect(JSON.parse(out.result).id).toBe(block.id)
  })

  it('refuse le carrousel hors Ultra, les types inconnus et les propriétés interdites, sans rien modifier', () => {
    const slides = blank()
    for (const input of [
      { slide: 1, type: 'carousel' },
      { slide: 1, type: 'image', props: { src: 'media/x.png' } },
      { slide: 1, type: 'hologramme' },
      { slide: 1, type: 'text', props: { src: 'x' } },
      { slide: 1, type: 'text', props: { onclick: 'alert(1)' } },
      { slide: 1, type: 'text', props: { color: 'url(javascript:x)' } },
      { slide: 1, type: 'text', props: { textAlign: 'diagonal' } },
      { slide: 9, type: 'text' },
    ]) {
      const out = executeTool(slides, 'add_block', input, basic)
      expect(out.isError, JSON.stringify(input)).toBe(true)
      expect(out.slides).toBe(slides)
    }
  })

  it('exige Ultra pour le bloc page web et normalise son adresse', () => {
    expect(executeTool(blank(), 'add_block', { slide: 1, type: 'webview' }, basic).isError).toBe(true)
    expect(executeTool(blank(), 'add_block', { slide: 1, type: 'webview', props: { url: 'javascript:alert(1)' } }, ultra).isError).toBe(true)
    const out = apply(blank(), 'add_block', { slide: 1, type: 'webview', props: { url: 'example.com' } }, ultra)
    expect((out.slides[0].blocks[0] as { url: string }).url).toBe('https://example.com/')
  })

  it('borne les nombres dans leur plage', () => {
    const out = apply(blank(), 'add_block', {
      slide: 1, type: 'text', props: { fontSize: 99999, width: -50, opacity: 7, x: 1e9 },
    })
    expect(out.slides[0].blocks[0]).toMatchObject({ fontSize: 400, width: 10, opacity: 1, x: 1920 })
  })

  it('met à jour et supprime un bloc par id', () => {
    const added = apply(blank(), 'add_block', { slide: 1, type: 'text', props: { content: 'a' } })
    const id = JSON.parse(added.result).id
    const updated = apply(added.slides, 'update_block', { slide: 1, id, props: { content: 'b' } })
    expect((updated.slides[0].blocks[0] as { content: string }).content).toBe('b')
    expect(executeTool(updated.slides, 'update_block', { slide: 1, id: 42, props: { content: 'x' } }, basic).isError).toBe(true)
    expect(apply(updated.slides, 'delete_block', { slide: 1, id }).slides[0].blocks).toHaveLength(0)
  })

  it('crée des blocs média vides et y place les pièces jointes par numéro', () => {
    const attachments: Attachment[] = [
      { id: 1, name: 'logo.png', key: 'media/img-1.png', kind: 'image', width: 800, height: 600 },
      { id: 2, name: 'demo.mp4', key: 'media/vid-2.mp4', kind: 'video' },
    ]
    const ctx = { ...ultra, attachments }
    let slides = apply(blank(), 'add_block', { slide: 1, type: 'image', props: { x: 10, y: 20 } }, ctx).slides
    slides = apply(slides, 'add_block', { slide: 1, type: 'video' }, ctx).slides
    slides = apply(slides, 'add_block', { slide: 1, type: 'carousel' }, ctx).slides
    const [image, video, carousel] = slides[0].blocks
    expect(image).toMatchObject({ type: 'image', src: '', x: 10 })

    slides = apply(slides, 'set_block_media', { slide: 1, id: image.id, attachments: [1] }, ctx).slides
    slides = apply(slides, 'set_block_media', { slide: 1, id: video.id, attachments: [2] }, ctx).slides
    slides = apply(slides, 'set_block_media', { slide: 1, id: carousel.id, attachments: [1, 1] }, ctx).slides
    expect(slides[0].blocks[0]).toMatchObject({ src: 'media/img-1.png', alt: 'logo.png' })
    expect(slides[0].blocks[1]).toMatchObject({ src: 'media/vid-2.mp4' })
    expect((slides[0].blocks[2] as { items: unknown[] }).items).toHaveLength(2)

    // Le modèle ne voit jamais les clés, seulement l'état « rempli ».
    const seen = executeTool(slides, 'get_slide', { slide: 1 }, ctx).result
    expect(seen).not.toContain('media/')
    expect(seen).toContain('rempli')
  })

  it('refuse un média mal assorti, inconnu, ou un carrousel hors Ultra', () => {
    const attachments: Attachment[] = [
      { id: 1, name: 'logo.png', key: 'media/img-1.png', kind: 'image' },
      { id: 2, name: 'demo.mp4', key: 'media/vid-2.mp4', kind: 'video' },
    ]
    const withAtt = { ...basic, attachments }
    const slides = apply(blank(), 'add_block', { slide: 1, type: 'image' }, withAtt).slides
    const id = slides[0].blocks[0].id
    for (const input of [
      { slide: 1, id, attachments: [2] },
      { slide: 1, id, attachments: [9] },
      { slide: 1, id, attachments: [1, 1] },
      { slide: 1, id, attachments: [] },
      { slide: 1, id, attachments: ['http://evil'] },
    ]) {
      const out = executeTool(slides, 'set_block_media', input, withAtt)
      expect(out.isError, JSON.stringify(input)).toBe(true)
      expect(out.slides).toBe(slides)
    }
    // Sans pièce jointe : message explicite.
    expect(executeTool(slides, 'set_block_media', { slide: 1, id, attachments: [1] }, basic).isError).toBe(true)
    // Carrousel déjà présent dans un projet, mais Ultra désactivé.
    const withCarousel: Slide[] = [{ id: 1, blocks: [{ id: 7, type: 'carousel', x: 0, y: 0, width: 100, height: 100, items: [] }] }]
    expect(executeTool(withCarousel, 'set_block_media', { slide: 1, id: 7, attachments: [1] }, withAtt).isError).toBe(true)
  })

  it('pose une forme personnalisée (points ou preset) et active le mode « grid »', () => {
    const triangle = [[0.5, 0], [1, 1], [0, 1]]
    let slides = apply(blank(), 'add_block', { slide: 1, type: 'shape', props: { customShape: triangle } }).slides
    expect(slides[0].blocks[0]).toMatchObject({ type: 'shape', shape: 'grid', customShape: triangle })

    // Preset par nom (accents et casse indifférents), et valeurs hors bornes ramenées dans [0, 1].
    slides = apply(slides, 'add_block', { slide: 1, type: 'shape', props: { customShape: 'coeur' } }).slides
    expect((slides[0].blocks[1] as { customShape: unknown[] }).customShape.length).toBeGreaterThan(10)
    const clamped = apply(blank(), 'add_block', { slide: 1, type: 'shape', props: { customShape: [[-1, 0], [2, 0.5], [0.5, 9]] } })
    expect(clamped.slides[0].blocks[0]).toMatchObject({ customShape: [[0, 0], [1, 0.5], [0.5, 1]] })

    // Image et vidéo : le contour découpe le média (shapeMode), la forme du bloc ne change pas.
    const image = apply(blank(), 'add_block', { slide: 1, type: 'image', props: { customShape: 'Étoile' } })
    expect(image.slides[0].blocks[0]).toMatchObject({ type: 'image', shapeMode: 'grid' })

    for (const customShape of [[[0, 0], [1, 1]], 'inconnu', [[0, 0], [1, 'x'], [1, 1]], 'x'.repeat(3), []]) {
      const out = executeTool(blank(), 'add_block', { slide: 1, type: 'shape', props: { customShape } }, basic)
      expect(out.isError, JSON.stringify(customShape)).toBe(true)
    }
  })

  it('règle, retire et valide les effets visuels (Ultra seulement)', () => {
    const base = apply(blank(), 'add_block', { slide: 1, type: 'shape' }, ultra).slides
    const id = base[0].blocks[0].id
    const input = { slide: 1, id, shadow: { y: 8, blur: 20 }, blur: 3, corners: 12 }
    expect(executeTool(base, 'set_block_effects', input, basic).isError).toBe(true)

    let slides = apply(base, 'set_block_effects', input, ultra).slides
    expect(slides[0].blocks[0].effects).toMatchObject({
      shadow: { x: 0, y: 8, blur: 20 }, blur: 3, corners: { tl: 12, tr: 12, br: 12, bl: 12 },
    })
    // null retire un effet, les autres restent ; retirer le dernier supprime l'objet.
    slides = apply(slides, 'set_block_effects', { slide: 1, id, shadow: null, corners: null }, ultra).slides
    expect(slides[0].blocks[0].effects).toEqual({ blur: 3 })
    slides = apply(slides, 'set_block_effects', { slide: 1, id, reset: true }, ultra).slides
    expect(slides[0].blocks[0].effects).toBeUndefined()

    for (const bad of [
      { slide: 1, id },
      { slide: 1, id, blur: 'beaucoup' },
      { slide: 1, id, blendMode: 'explosion' },
      { slide: 1, id, shadow: { color: 'url(javascript:x)' } },
      { slide: 1, id, onclick: 1 },
      { slide: 1, id, gradient: { from: '#fff' } },
    ]) {
      const out = executeTool(base, 'set_block_effects', bad, ultra)
      expect(out.isError, JSON.stringify(bad)).toBe(true)
      expect(out.slides).toBe(base)
    }
    // Bornes : un flou démesuré est ramené à 40.
    const big = apply(base, 'set_block_effects', { slide: 1, id, blur: 9999 }, ultra)
    expect(big.slides[0].blocks[0].effects?.blur).toBe(40)
  })

  it('ne laisse pas écrire la source d’un bloc média via update_block', () => {
    const slides: Slide[] = [{
      id: 1, blocks: [{ id: 5, type: 'image', x: 0, y: 0, width: 100, height: 100, src: 'media/a.png' }],
    }]
    expect(executeTool(slides, 'update_block', { slide: 1, id: 5, props: { src: 'http://evil' } }, basic).isError).toBe(true)
    const moved = apply(slides, 'update_block', { slide: 1, id: 5, props: { x: 50 } })
    expect(moved.slides[0].blocks[0]).toMatchObject({ x: 50, src: 'media/a.png' })
  })
})

describe('executeTool — diapositives', () => {
  it('ajoute, déplace et supprime, sans jamais retirer la dernière', () => {
    let slides = blank()
    slides = apply(slides, 'add_slide', {}).slides
    slides = apply(slides, 'add_slide', { position: 1 }).slides
    expect(slides).toHaveLength(3)
    const firstId = slides[0].id
    slides = apply(slides, 'move_slide', { slide: 1, to: 3 }).slides
    expect(slides[2].id).toBe(firstId)
    slides = apply(slides, 'delete_slide', { slide: 1 }).slides
    slides = apply(slides, 'delete_slide', { slide: 1 }).slides
    expect(executeTool(slides, 'delete_slide', { slide: 1 }, basic).isError).toBe(true)
  })

  it('règle le fond ; le dégradé exige Ultra', () => {
    const color = apply(blank(), 'set_slide_background', { slide: 1, type: 'color', color: '#112233' })
    expect(color.slides[0].background).toEqual({ type: 'color', color: '#112233' })
    expect(executeTool(blank(), 'set_slide_background', { slide: 1, type: 'gradient', from: '#000', to: '#fff' }, basic).isError).toBe(true)
    expect(apply(blank(), 'set_slide_background', { slide: 1, type: 'gradient', from: '#000', to: '#fff' }, ultra)
      .slides[0].background?.type).toBe('gradient')
  })

  it('valide les transitions et les mouvements (existence, phase, niveau)', () => {
    expect(apply(blank(), 'set_slide_transition', { slide: 1, preset: 'fade' }).slides[0].transition).toEqual({ preset: 'fade' })
    expect(executeTool(blank(), 'set_slide_transition', { slide: 1, preset: 'nope' }, basic).isError).toBe(true)
    expect(executeTool(blank(), 'set_slide_transition', { slide: 1, preset: 'flip-3d' }, basic).isError).toBe(true)

    const added = apply(blank(), 'add_block', { slide: 1, type: 'text' })
    const id = JSON.parse(added.result).id
    const withMotion = apply(added.slides, 'set_block_motion', { slide: 1, id, phase: 'in', preset: 'fade', delay: 0.5 })
    expect(withMotion.slides[0].blocks[0].motion?.in).toEqual({ preset: 'fade', delay: 0.5 })
    // Un mouvement de sortie ne se pose pas en entrée.
    expect(executeTool(added.slides, 'set_block_motion', { slide: 1, id, phase: 'in', preset: 'fade-out' }, basic).isError).toBe(true)
    // Retrait.
    expect(apply(withMotion.slides, 'set_block_motion', { slide: 1, id, phase: 'in', preset: null })
      .slides[0].blocks[0].motion?.in).toBeUndefined()
  })

  it('renvoie une erreur pour un outil inconnu ou une entrée absurde', () => {
    expect(executeTool(blank(), 'rm_rf', {}, basic).isError).toBe(true)
    expect(executeTool(blank(), 'add_block', 'texte', basic).isError).toBe(true)
    expect(executeTool(blank(), 'add_block', null, basic).isError).toBe(true)
  })
})

describe('executeTool — numérotation', () => {
  it('active la numérotation sans toucher aux diapositives', () => {
    const slides = blank()
    const out = apply(slides, 'set_numbering', { enabled: true, format: 'n-total', position: 'bottom-center', skipFirst: true })
    expect(out.slides).toBe(slides)
    expect(out.numbering).toMatchObject({ enabled: true, format: 'n-total', position: 'bottom-center', skipFirst: true })
  })

  it('ne change que les champs fournis et borne les valeurs', () => {
    const base = apply(blank(), 'set_numbering', { enabled: true, bold: true }).numbering!
    const out = apply(blank(), 'set_numbering', { size: 500, color: '#ff0000' }, { ...basic, numbering: base } as typeof basic)
    expect(out.numbering).toMatchObject({ enabled: true, bold: true, size: 72, color: '#ff0000' })
  })

  it('refuse les entrées invalides', () => {
    for (const bad of [{}, { format: 'abc' }, { position: 'milieu' }, { color: 'rouge' }, { enabled: 'oui' }, { foo: 1 }]) {
      expect(executeTool(blank(), 'set_numbering', bad, basic).isError).toBe(true)
    }
  })
})
