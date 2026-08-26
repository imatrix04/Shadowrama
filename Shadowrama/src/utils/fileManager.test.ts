import { describe, expect, it } from 'vitest'
import { ProjectFormatError, parseManifestSlides } from './fileManager'
import type { TextBlockData } from '../types'

const validBlock = {
  type: 'text', id: 1, x: 10, y: 20, width: 100, height: 40, content: 'salut',
}

function manifest(slides: unknown): string {
  return JSON.stringify({ version: 2, slides })
}

describe('parseManifestSlides', () => {
  it('lit un manifeste v2', () => {
    const slides = parseManifestSlides(manifest([{ id: 5, blocks: [validBlock] }]))

    expect(slides).toHaveLength(1)
    expect(slides[0].id).toBe(5)
    expect(slides[0].blocks[0]).toMatchObject({ type: 'text', content: 'salut' })
  })

  // v1 : le manifeste était directement le tableau de diapositives. Les fichiers
  // enregistrés avec ces versions doivent rester ouvrables.
  it('lit un manifeste v1, qui était un simple tableau', () => {
    const slides = parseManifestSlides(JSON.stringify([{ id: 5, blocks: [validBlock] }]))

    expect(slides).toHaveLength(1)
    expect(slides[0].blocks).toHaveLength(1)
  })

  it('rejette un contenu qui nest pas du JSON', () => {
    expect(() => parseManifestSlides('pas du json')).toThrow(ProjectFormatError)
  })

  it('rejette un manifeste sans tableau de diapositives', () => {
    expect(() => parseManifestSlides(JSON.stringify({ version: 2 }))).toThrow(ProjectFormatError)
  })

  it('rend une diapositive vierge plutôt quun projet sans diapositive', () => {
    const slides = parseManifestSlides(manifest([]))

    expect(slides).toHaveLength(1)
    expect(slides[0].blocks).toEqual([])
  })

  // Un bloc d'un type disparu ne doit pas faire tomber le rendu de toute la
  // présentation : on le laisse de côté et le reste s'ouvre.
  it('écarte les blocs dun type inconnu', () => {
    const slides = parseManifestSlides(manifest([
      { id: 1, blocks: [validBlock, { ...validBlock, id: 2, type: 'hologramme' }] },
    ]))

    expect(slides[0].blocks).toHaveLength(1)
    expect(slides[0].blocks[0].id).toBe(1)
  })

  it('écarte les blocs dont la géométrie nest pas numérique', () => {
    const slides = parseManifestSlides(manifest([
      { id: 1, blocks: [{ ...validBlock, id: 2, width: 'large' }] },
    ]))

    expect(slides[0].blocks).toEqual([])
  })

  it('écarte ce qui nest pas un objet', () => {
    const slides = parseManifestSlides(manifest([{ id: 1, blocks: [null, 42, validBlock] }]))

    expect(slides[0].blocks).toHaveLength(1)
  })

  it('tolère une diapositive sans tableau de blocs', () => {
    const slides = parseManifestSlides(manifest([{ id: 1 }]))

    expect(slides[0].blocks).toEqual([])
  })

  it('attribue un identifiant aux diapositives qui nen ont pas', () => {
    const slides = parseManifestSlides(manifest([{ blocks: [] }]))

    expect(typeof slides[0].id).toBe('number')
  })

  // `properties` était autrefois recopié dans chaque bloc puis sérialisé : le
  // garder figerait les champs éditables tels qu'ils étaient à l'enregistrement.
  it('retire le champ properties hérité des anciens fichiers', () => {
    const slides = parseManifestSlides(manifest([
      { id: 1, blocks: [{ ...validBlock, properties: [{ key: 'obsolète' }] }] },
    ]))

    expect(slides[0].blocks[0]).not.toHaveProperty('properties')
  })

  it('conserve les réglages Ultra dun bloc', () => {
    const slides = parseManifestSlides(manifest([
      {
        id: 1,
        blocks: [{ ...validBlock, motion: { in: { preset: 'fondu', speed: 2 } } }],
      },
    ]))

    const block = slides[0].blocks[0] as TextBlockData
    expect(block.motion?.in).toEqual({ preset: 'fondu', speed: 2 })
  })
})
