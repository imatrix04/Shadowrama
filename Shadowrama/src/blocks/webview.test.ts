import { describe, expect, it } from 'vitest'
import { BLOCKS_REGISTRY, getBlockConfig, getBlockProperties, isKnownBlockType } from './index'
import { parseManifestSlides } from '../utils/fileManager'

const manifest = (blocks: unknown[]) => JSON.stringify({ version: 2, slides: [{ id: 1, blocks }] })
const block = (extra: Record<string, unknown>) => ({
  id: 7, type: 'webview', x: 10, y: 20, width: 640, height: 360, ...extra,
})

describe('bloc « Page web » : enregistrement', () => {
  it('est un type connu, avec sa config et son composant', () => {
    expect(isKnownBlockType('webview')).toBe(true)
    expect(getBlockConfig('webview')?.label).toBe('Page web')
    expect(BLOCKS_REGISTRY.webview).toBeTypeOf('function')
  })

  it('expose son adresse en premier, puis les champs communs', () => {
    const keys = getBlockProperties('webview').map(p => p.key)
    expect(keys[0]).toBe('url')
    expect(keys).toContain('opacity')
    expect(keys).toContain('rotation')
  })

  it('est réservé au mode Ultra Design, comme le carrousel', () => {
    expect(getBlockConfig('webview')?.ultraOnly).toBe(true)
  })
})

describe('bloc « Page web » : lecture d’un projet', () => {
  it('garde une adresse valide, normalisée', () => {
    const [slide] = parseManifestSlides(manifest([block({ url: 'localhost:3000' })]))
    expect(slide.blocks[0]).toMatchObject({ type: 'webview', url: 'http://localhost:3000/' })
  })

  it('vide une adresse dangereuse ou illisible sans écarter le bloc', () => {
    for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,x', 42, null, undefined]) {
      const [slide] = parseManifestSlides(manifest([block({ url })]))
      expect(slide.blocks).toHaveLength(1)
      expect(slide.blocks[0]).toMatchObject({ type: 'webview', url: '' })
    }
  })

  it('conserve les autres réglages du bloc', () => {
    const [slide] = parseManifestSlides(manifest([block({
      url: 'https://example.com', showToolbar: false, borderRadius: 12, rotation: 5,
    })]))
    expect(slide.blocks[0]).toMatchObject({ showToolbar: false, borderRadius: 12, rotation: 5 })
  })
})