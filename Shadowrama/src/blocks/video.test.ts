import { describe, expect, it } from 'vitest'
import { BLOCKS_REGISTRY, getBlockConfig, getBlockProperties, isKnownBlockType } from './index'
import { parseManifestSlides } from '../utils/fileManager'
import { blockMediaKeys } from '../utils/blockMedia'
import { heightForRatio, resolvePlayback, sanitizeVideoSrc } from '../utils/video'
import { generateMediaKey } from '../utils/mediaStore'
import { getFrameStyle } from './registry/frameStyle'
import type { BlockData } from '../types'

const manifest = (blocks: unknown[]) => JSON.stringify({ version: 2, slides: [{ id: 1, blocks }] })
const block = (extra: Record<string, unknown>) => ({
  id: 3, type: 'video', x: 10, y: 20, width: 480, height: 270, ...extra,
})
const firstBlock = (extra: Record<string, unknown>) =>
  parseManifestSlides(manifest([block(extra)]))[0].blocks[0] as unknown as Record<string, unknown>

describe('bloc vidéo : enregistrement', () => {
  it('est un type connu, avec sa config et son composant', () => {
    expect(isKnownBlockType('video')).toBe(true)
    expect(getBlockConfig('video')?.label).toBe('Vidéo')
    expect(BLOCKS_REGISTRY.video).toBeTypeOf('function')
  })

  it('n’est pas réservé au mode Ultra Design, comme l’image', () => {
    expect(getBlockConfig('video')?.ultraOnly).toBeFalsy()
    expect(getBlockConfig('image')?.ultraOnly).toBeFalsy()
  })

  it('offre les mêmes réglages de cadrage que l’image', () => {
    const frame = ['objectFit', 'borderRadius', 'shapeMode', 'customShape']
    const keys = (type: string) => getBlockProperties(type).map(p => p.key)
    for (const key of frame) {
      expect(keys('video'), key).toContain(key)
      expect(keys('image'), key).toContain(key)
    }
    expect(keys('video')).toContain('opacity')
    expect(keys('video')).toContain('rotation')
  })

  it('demande un fichier vidéo pour sa source', () => {
    const src = getBlockProperties('video').find(p => p.key === 'src')
    expect(src?.type).toBe('file')
    expect(src?.accept).toBe('video/*')
  })
})

describe('bloc vidéo : lecture du .shma', () => {
  it('garde une vidéo valide et ses animations', () => {
    const b = firstBlock({
      src: 'media/vid-1-2.mp4',
      motion: { in: { preset: 'fondu' } },
      effects: { float: { amplitude: 10, duration: 3 } },
    })
    expect(b.src).toBe('media/vid-1-2.mp4')
    expect(b.motion).toEqual({ in: { preset: 'fondu' } })
    expect(b.effects).toBeDefined()
  })

  it('refuse toute source qui ne vient pas du projet', () => {
    for (const bad of ['file:///etc/passwd', 'https://example.com/a.mp4', 'javascript:alert(1)', 42, null]) {
      expect(firstBlock({ src: bad }).src, String(bad)).toBe('')
    }
  })

  it('remet les réglages de lecture dans une forme saine', () => {
    const b = firstBlock({
      src: 'media/vid-1-2.mp4', autoplay: 'oui', volume: 'fort', playbackRate: '1.5', startTime: -3, endTime: '12',
    })
    expect('autoplay' in b).toBe(false)
    expect('volume' in b).toBe(false)
    expect(b.playbackRate).toBe(1.5)
    expect(b.endTime).toBe(12)
  })
})

describe('résolution des réglages de lecture', () => {
  it('applique les valeurs par défaut', () => {
    expect(resolvePlayback({})).toEqual({
      autoplay: true, loop: false, muted: false, volume: 1, showControls: false,
      playbackRate: 1, startTime: 0, endTime: 0,
    })
  })

  it('borne volume, vitesse et début', () => {
    const p = resolvePlayback({ volume: 5, playbackRate: 99, startTime: -2 })
    expect(p.volume).toBe(1)
    expect(p.playbackRate).toBe(4)
    expect(p.startTime).toBe(0)
    expect(resolvePlayback({ playbackRate: 0 }).playbackRate).toBe(0.25)
  })

  it('accepte les valeurs d’un menu, qui sont des chaînes', () => {
    expect(resolvePlayback({ playbackRate: '2' as unknown as number }).playbackRate).toBe(2)
  })

  it('ignore une fin placée avant le début', () => {
    expect(resolvePlayback({ startTime: 10, endTime: 4 }).endTime).toBe(0)
    expect(resolvePlayback({ startTime: 2, endTime: 8 }).endTime).toBe(8)
  })
})

describe('médias référencés par un bloc', () => {
  it('compte la source d’une vidéo comme celle d’une image', () => {
    const video = { id: 1, type: 'video', x: 0, y: 0, width: 1, height: 1, src: 'media/vid-1.mp4' } as BlockData
    const image = { id: 2, type: 'image', x: 0, y: 0, width: 1, height: 1, src: 'media/img-1.png' } as BlockData
    expect(blockMediaKeys(video)).toEqual(['media/vid-1.mp4'])
    expect(blockMediaKeys(image)).toEqual(['media/img-1.png'])
  })

  it('ignore une source vide ou externe', () => {
    const b = { id: 1, type: 'video', x: 0, y: 0, width: 1, height: 1, src: '' } as BlockData
    expect(blockMediaKeys(b)).toEqual([])
  })
})

describe('utilitaires vidéo', () => {
  it('ne garde que les clés du projet', () => {
    expect(sanitizeVideoSrc('media/vid-1.mp4')).toBe('media/vid-1.mp4')
    expect(sanitizeVideoSrc('http://x/y.mp4')).toBe('')
  })

  it('suit le rapport de la vidéo', () => {
    expect(heightForRatio(480, 1920, 1080)).toBe(270)
    expect(heightForRatio(300, 1080, 1920)).toBe(533)
    expect(heightForRatio(480, 0, 0)).toBeUndefined()
  })

  it('nomme les clés selon le type de média', () => {
    expect(generateMediaKey('clip.MP4', 'vid')).toMatch(/^media\/vid-\d+-\d+\.mp4$/)
    expect(generateMediaKey('photo.png')).toMatch(/^media\/img-\d+-\d+\.png$/)
    expect(generateMediaKey('sans-extension', 'vid')).toMatch(/\.mp4$/)
  })
})

describe('cadrage partagé avec l’image', () => {
  const triangle: [number, number][] = [[0.5, 0], [1, 1], [0, 1]]

  it('arrondit et cadre par défaut', () => {
    expect(getFrameStyle({}, 400, 200)).toEqual({ borderRadius: 0, objectFit: 'cover' })
    expect(getFrameStyle({ borderRadius: 12, objectFit: 'contain' }, 400, 200))
      .toEqual({ borderRadius: 12, objectFit: 'contain' })
  })

  it('découpe dans la forme libre et laisse l’arrondi au masque', () => {
    const style = getFrameStyle({ shapeMode: 'grid', customShape: triangle, borderRadius: 12 }, 400, 200)
    expect(String(style.maskImage)).toContain('data:image/svg+xml')
    expect(style.borderRadius).toBe(0)
  })

  it('ignore une forme de moins de trois sommets', () => {
    const style = getFrameStyle({ shapeMode: 'grid', customShape: [[0, 0], [1, 1]], borderRadius: 5 }, 400, 200)
    expect(style.maskImage).toBeUndefined()
    expect(style.borderRadius).toBe(5)
  })
})