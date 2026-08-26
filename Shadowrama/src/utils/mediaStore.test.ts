import { beforeEach, describe, expect, it, vi } from 'vitest'

type MediaStoreModule = typeof import('./mediaStore')

let mediaStore: MediaStoreModule

beforeEach(async () => {
  // Le store vit au niveau du module : on repart d'une ardoise vierge.
  vi.resetModules()

  // jsdom n'implémente pas l'API Blob URL, et IndexedDB n'existe pas non plus —
  // le store est écrit pour dégrader proprement dans ce cas (persistance
  // ignorée), c'est exactement le chemin qu'on veut voir tenir.
  let counter = 0
  URL.createObjectURL = () => `blob:test/${counter++}`
  URL.revokeObjectURL = () => {}

  mediaStore = await import('./mediaStore')
})

const bytes = (n: number) => new Uint8Array([n, n + 1, n + 2])

describe('mediaStore', () => {
  it('rend une URL exploitable pour un média enregistré', () => {
    mediaStore.registerMedia('media/a.png', bytes(1), 'image/png')

    expect(mediaStore.resolveMedia('media/a.png')).toMatch(/^blob:/)
  })

  it('rend undefined pour une clé inconnue', () => {
    expect(mediaStore.resolveMedia('media/absent.png')).toBeUndefined()
  })

  it("n'écrit dans le fichier que les médias encore référencés", () => {
    mediaStore.registerMedia('media/gardee.png', bytes(1), 'image/png')
    mediaStore.registerMedia('media/orpheline.png', bytes(9), 'image/png')

    const written = mediaStore.getAllMediaForSave(new Set(['media/gardee.png']))

    expect(written.map(m => m.key)).toEqual(['media/gardee.png'])
  })

  /**
   * Régression : une version antérieure PURGEAIT ici les médias non référencés.
   * Supprimer une image, enregistrer, puis annuler ramenait donc un bloc dont le
   * média avait disparu du cache et d'IndexedDB — une perte définitive, alors
   * qu'un Ctrl+Z est précisément censé l'empêcher.
   */
  it('conserve les médias non référencés, pour que lannulation les retrouve', () => {
    mediaStore.registerMedia('media/supprimee.png', bytes(9), 'image/png')

    mediaStore.getAllMediaForSave(new Set())

    expect(mediaStore.resolveMedia('media/supprimee.png')).toMatch(/^blob:/)
  })

  it('rend les octets tels quels, sans passer par du base64', () => {
    mediaStore.registerMedia('media/a.png', bytes(1), 'image/png')

    const [entry] = mediaStore.getAllMediaForSave(new Set(['media/a.png']))
    expect(entry.data).toBeInstanceOf(Uint8Array)
    expect(Array.from(entry.data)).toEqual([1, 2, 3])
  })

  it('remplace un média réenregistré sous la même clé', () => {
    mediaStore.registerMedia('media/a.png', bytes(1), 'image/png')
    mediaStore.registerMedia('media/a.png', bytes(7), 'image/png')

    const [entry] = mediaStore.getAllMediaForSave(new Set(['media/a.png']))
    expect(Array.from(entry.data)).toEqual([7, 8, 9])
  })

  it('vide tout le store', () => {
    mediaStore.registerMedia('media/a.png', bytes(1), 'image/png')
    mediaStore.clearMediaStore()

    expect(mediaStore.resolveMedia('media/a.png')).toBeUndefined()
    expect(mediaStore.getAllMediaForSave(new Set(['media/a.png']))).toEqual([])
  })

  it('décode le format base64 hérité des versions antérieures', () => {
    // "AQID" = octets 1, 2, 3
    expect(Array.from(mediaStore.base64ToBytes('AQID'))).toEqual([1, 2, 3])
  })

  it('génère des clés préfixées media/ en normalisant lextension', () => {
    const key = mediaStore.generateMediaKey('vacances.JPEG')

    expect(key.startsWith('media/')).toBe(true)
    // Minuscules : guessMimeType compare des suffixes en minuscules, un
    // « .JPEG » conservé tel quel serait typé application/octet-stream.
    expect(key.endsWith('.jpeg')).toBe(true)
  })

  it('retombe sur png quand le nom na pas dextension', () => {
    expect(mediaStore.generateMediaKey('sansextension')).toMatch(/\.png$/)
  })

  it('génère des clés distinctes pour deux imports du même fichier', () => {
    const keys = new Set(Array.from({ length: 50 }, () => mediaStore.generateMediaKey('a.png')))

    // Collision possible mais très improbable : on vérifie surtout que la clé
    // n'est pas purement dérivée du nom de fichier.
    expect(keys.size).toBeGreaterThan(1)
  })
})
