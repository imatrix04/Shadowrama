import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BlockData, ImageBlockData, TextBlockData } from '../types'

type ClipboardModule = typeof import('./clipboard')

/** Le presse-papiers garde son état au niveau du module : on le recharge à chaque test. */
let clipboard: ClipboardModule

beforeEach(async () => {
  vi.resetModules()
  clipboard = await import('./clipboard')
})

const PASTE_OFFSET = 16

function text(id: number): TextBlockData {
  return { type: 'text', id, x: 100, y: 100, width: 80, height: 20, content: 'bonjour' }
}

function image(id: number, src: string): ImageBlockData {
  return { type: 'image', id, x: 0, y: 0, width: 80, height: 80, src }
}

describe('presse-papiers de blocs', () => {
  it('rend null quand rien na été copié', () => {
    expect(clipboard.readClipboard(1)).toBeNull()
    expect(clipboard.hasClipboard()).toBe(false)
  })

  it('ignore une copie vide', () => {
    clipboard.writeClipboard([], 1, 'copy')
    expect(clipboard.hasClipboard()).toBe(false)
  })

  // Coller sur la diapositive source recouvrirait l'original : on décale.
  it('décale le premier collage sur la diapositive dorigine', () => {
    clipboard.writeClipboard([text(1)], 7, 'copy')
    expect(clipboard.readClipboard(7)?.shift).toBe(PASTE_OFFSET)
  })

  // La place est libre : la copie doit retomber exactement là où elle était.
  it('ne décale pas un collage sur une autre diapositive', () => {
    clipboard.writeClipboard([text(1)], 7, 'copy')
    expect(clipboard.readClipboard(8)?.shift).toBe(0)
  })

  it('ne décale pas le premier collage après un couper', () => {
    clipboard.writeClipboard([text(1)], 7, 'cut')
    expect(clipboard.readClipboard(7)?.shift).toBe(0)
  })

  it('enchaîne les décalages sur les collages successifs', () => {
    clipboard.writeClipboard([text(1)], 7, 'cut')
    expect(clipboard.readClipboard(7)?.shift).toBe(0)
    expect(clipboard.readClipboard(7)?.shift).toBe(PASTE_OFFSET)
    expect(clipboard.readClipboard(7)?.shift).toBe(PASTE_OFFSET * 2)
  })

  it('permet de coller plusieurs fois : le contenu nest pas consommé', () => {
    clipboard.writeClipboard([text(1)], 7, 'copy')
    clipboard.readClipboard(7)
    expect(clipboard.readClipboard(7)?.blocks).toHaveLength(1)
  })

  // Une copie de surface laisserait le presse-papiers suivre les modifications
  // faites au bloc après le Ctrl+C.
  it('copie en profondeur à lécriture', () => {
    const block = {
      ...text(1),
      effects: { shadow: { x: 1, y: 1, blur: 2, color: '#000' } },
    } as BlockData

    clipboard.writeClipboard([block], 7, 'copy')
    ;(block as TextBlockData).content = 'modifié'
    block.effects!.shadow!.blur = 99

    const pasted = clipboard.readClipboard(8)!.blocks[0] as TextBlockData
    expect(pasted.content).toBe('bonjour')
    expect(pasted.effects!.shadow!.blur).toBe(2)
  })

  it('copie en profondeur à la lecture : deux collages sont indépendants', () => {
    clipboard.writeClipboard([text(1)], 7, 'copy')
    const first = clipboard.readClipboard(8)!.blocks[0]
    const second = clipboard.readClipboard(8)!.blocks[0]

    expect(first).not.toBe(second)
  })

  // Sans ces clés, couper une image puis enregistrer purgerait le média et le
  // collage suivant ne montrerait qu'un cadre vide.
  it('retient les clés média des images coupées', () => {
    clipboard.writeClipboard([image(1, 'media/photo.png'), text(2)], 7, 'cut')
    expect(clipboard.clipboardMediaKeys()).toEqual(['media/photo.png'])
  })

  it('ignore les sources qui ne sont pas des clés média', () => {
    clipboard.writeClipboard([image(1, 'https://exemple.test/a.png')], 7, 'copy')
    expect(clipboard.clipboardMediaKeys()).toEqual([])
  })

  it('ne retient aucune clé quand le presse-papiers est vide', () => {
    expect(clipboard.clipboardMediaKeys()).toEqual([])
  })
})
