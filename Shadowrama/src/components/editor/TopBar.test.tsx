import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Slide } from '../../types'
import { DEFAULT_NUMBERING } from '../../utils/numbering'
import TopBar from './TopBar'

// Le disque et le store média sont hors sujet : on ne teste ici que les
// décisions de la barre (prévenir, confirmer, ne pas sauvegarder deux fois).
const files = vi.hoisted(() => ({
  openProject: vi.fn(),
  importPowerPoint: vi.fn(),
  saveProjectToPath: vi.fn(),
  saveProjectAs: vi.fn(),
  clearDraft: vi.fn(),
  rememberRecent: vi.fn(),
}))

vi.mock('../../utils/fileManager', async importOriginal => ({
  ...await importOriginal<typeof import('../../utils/fileManager')>(),
  ...files,
}))

vi.mock('../../utils/mediaStore', () => ({ clearMediaStore: vi.fn() }))

// Jamais affiché ici (`presenting` reste faux), et il tire GSAP et tout le rendu
// des blocs : inutile de le charger.
vi.mock('./PresentationMode', () => ({ default: () => null }))

const BLANK: Slide[] = [{ id: 1, blocks: [] }]
const FILLED: Slide[] = [{
  id: 1,
  blocks: [{ id: 2, type: 'shape', x: 0, y: 0, width: 10, height: 10 } as Slide['blocks'][number]],
}]

function setup(overrides: Partial<Parameters<typeof TopBar>[0]> = {}) {
  const props: Parameters<typeof TopBar>[0] = {
    slides: FILLED,
    numbering: DEFAULT_NUMBERING,
    projectName: 'demo',
    setProjectName: vi.fn(),
    filePath: 'C:\\projets\\demo.shma',
    setFilePath: vi.fn(),
    onLoad: vi.fn(),
    onNew: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    canUndo: false,
    canRedo: false,
    draftFailed: false,
    initialDirty: false,
    onDirtyChange: vi.fn(),
    ultra: false,
    onToggleUltra: vi.fn(),
    presenting: false,
    onPresentingChange: vi.fn(),
    ...overrides,
  }
  render(<MemoryRouter><TopBar {...props} /></MemoryRouter>)
  return props
}

const click = (label: RegExp) => fireEvent.click(screen.getByRole('button', { name: label }))
// Nouveau / Ouvrir / Importer / Enregistrer / Exporter vivent dans le menu « Fichier ».
const openFileMenu = () => fireEvent.click(screen.getByRole('button', { name: /^Fichier/ }))
const clickMenuItem = (label: RegExp) => {
  openFileMenu()
  fireEvent.click(screen.getByRole('menuitem', { name: label }))
}
// Le menu doit être rendu AVANT d'entrer dans `act` asynchrone : à l'intérieur,
// l'ouverture n'est appliquée qu'à la sortie et l'élément serait introuvable.
const clickMenuItemAsync = async (label: RegExp) => {
  openFileMenu()
  await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: label })) })
}
const dirtyDot = () => screen.queryByTitle('Non sauvegardé')
const confirmation = () => screen.queryByRole('dialog', { name: 'Modifications non sauvegardées' })

beforeEach(() => {
  for (const mock of Object.values(files)) mock.mockReset()
  files.openProject.mockResolvedValue(null)
  files.importPowerPoint.mockResolvedValue(null)
})

afterEach(cleanup)

describe('TopBar — état « non sauvegardé »', () => {
  it('présente comme enregistré un brouillon identique à son fichier', () => {
    const props = setup({ initialDirty: false })

    expect(dirtyDot()).toBeNull()
    expect(props.onDirtyChange).toHaveBeenLastCalledWith(false)
  })

  /**
   * Régression : avoir un chemin de fichier suffisait à être « enregistré ».
   * Après un redémarrage, les modifications restées dans le brouillon passaient
   * donc pour sauvegardées, et rien n'avertissait avant de les écraser.
   */
  it('signale un brouillon qui contient des modifications jamais écrites dans le fichier', () => {
    const props = setup({ initialDirty: true })

    expect(dirtyDot()).not.toBeNull()
    expect(props.onDirtyChange).toHaveBeenLastCalledWith(true)
  })
})

describe('TopBar — remplacement du projet en cours', () => {
  /**
   * Régression : seul « Nouveau » demandait confirmation. « Ouvrir » et
   * « Importer » remplaçaient le projet — et vidaient ses médias — sans un mot.
   */
  it.each([
    ['Ouvrir', /Ouvrir/, () => files.openProject],
    ['Importer', /Importer/, () => files.importPowerPoint],
  ])('%s demande confirmation quand le travail n\'est pas enregistré', async (_name, label, action) => {
    setup({ initialDirty: true })

    clickMenuItem(label)
    expect(confirmation()).not.toBeNull()
    expect(action()).not.toHaveBeenCalled()

    await act(async () => { click(/Continuer/) })
    expect(action()).toHaveBeenCalledTimes(1)
    expect(confirmation()).toBeNull()
  })

  it('Annuler garde le projet en cours', () => {
    setup({ initialDirty: true })

    clickMenuItem(/Ouvrir/)
    click(/^Annuler$/)

    expect(confirmation()).toBeNull()
    expect(files.openProject).not.toHaveBeenCalled()
  })

  it('ouvre directement quand tout est enregistré', async () => {
    setup({ initialDirty: false })

    await clickMenuItemAsync(/Ouvrir/)

    expect(confirmation()).toBeNull()
    expect(files.openProject).toHaveBeenCalledTimes(1)
  })

  it("ne demande rien pour un projet vierge jamais enregistré : il n'y a rien à perdre", async () => {
    setup({ slides: BLANK, filePath: null, projectName: null })

    await clickMenuItemAsync(/Ouvrir/)

    expect(confirmation()).toBeNull()
    expect(files.openProject).toHaveBeenCalledTimes(1)
  })
})

describe('TopBar — sauvegarde', () => {
  /**
   * Régression : deux Ctrl+S rapprochés lançaient deux écritures concurrentes
   * du même fichier.
   */
  it("n'écrit qu'une fois quand Ctrl+S est répété pendant une sauvegarde", async () => {
    let finish: (path: string) => void = () => {}
    files.saveProjectToPath.mockImplementation(() => new Promise<string>(resolve => { finish = resolve }))
    setup({ initialDirty: true })
    const save = () => fireEvent.keyDown(window, { key: 's', ctrlKey: true })

    await act(async () => {
      save()
      save()
      // `handleSave` cède la main une fois avant d'écrire (voir son commentaire).
      await new Promise(resolve => setTimeout(resolve, 10))
    })
    expect(files.saveProjectToPath).toHaveBeenCalledTimes(1)

    await act(async () => { finish('C:\\projets\\demo.shma') })
    expect(dirtyDot()).toBeNull()

    // Le verrou est rendu : la sauvegarde suivante passe.
    await act(async () => {
      save()
      await new Promise(resolve => setTimeout(resolve, 10))
    })
    expect(files.saveProjectToPath).toHaveBeenCalledTimes(2)
  })
})
