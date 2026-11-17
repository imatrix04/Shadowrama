import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ColorPicker from './ColorPicker'
import { ProjectColorsContext } from './ProjectColorsContext'
import { pinColor, unpinColor, useColorSwatches } from '../../utils/colorSwatchStore'

afterEach(() => {
  cleanup()
  delete (window as unknown as { EyeDropper?: unknown }).EyeDropper
  for (const color of ['#123456', '#abcdef', '#0a0b0c']) unpinColor(color)
})

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Choisir une couleur' }))
const dialog = () => screen.queryByRole('dialog', { name: 'Sélecteur de couleur' })
const tab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }))

function setup(value = '#ff6b4a') {
  const onChange = vi.fn()
  render(<ColorPicker value={value} onChange={onChange} />)
  open()
  return onChange
}

describe('ColorPicker', () => {
  it("s'ouvre au clic et se ferme avec Échap", () => {
    setup()
    expect(dialog()).not.toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(dialog()).toBeNull()
  })

  it('se ferme en cliquant ailleurs, mais pas en cliquant dedans', () => {
    setup()
    fireEvent.mouseDown(dialog()!)
    expect(dialog()).not.toBeNull()
    fireEvent.mouseDown(document.body)
    expect(dialog()).toBeNull()
  })

  it('applique une valeur hexadécimale complète pendant la frappe', () => {
    const onChange = setup()
    tab('HEX')
    const field = screen.getByLabelText('Valeur hexadécimale')
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: '#123456' } })
    expect(onChange).toHaveBeenLastCalledWith('#123456')
  })

  it("accepte l'écriture courte et normalise (ABC → #aabbcc) à la validation", () => {
    const onChange = setup()
    tab('HEX')
    const field = screen.getByLabelText('Valeur hexadécimale')
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: 'ABC' } })
    fireEvent.blur(field)
    expect(onChange).toHaveBeenLastCalledWith('#aabbcc')
  })

  it("ignore une valeur invalide sans rien appliquer", () => {
    const onChange = setup()
    tab('HEX')
    const field = screen.getByLabelText('Valeur hexadécimale')
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: 'zzz' } })
    fireEvent.blur(field)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('propose RGB avec les bons canaux et applique une saisie', () => {
    const onChange = setup('#ff6b4a')
    tab('RGB')
    const [r, g, b] = screen.getAllByRole('textbox') as HTMLInputElement[]
    expect([r.value, g.value, b.value]).toEqual(['255', '107', '74'])
    fireEvent.focus(r)
    fireEvent.change(r, { target: { value: '0' } })
    expect(onChange).toHaveBeenLastCalledWith('#006b4a')
  })

  it('borne les canaux RGB à 255', () => {
    const onChange = setup('#000000')
    tab('RGB')
    const [r] = screen.getAllByRole('textbox')
    fireEvent.focus(r)
    fireEvent.change(r, { target: { value: '999' } })
    expect(onChange).toHaveBeenLastCalledWith('#ff0000')
  })

  it('propose HSL', () => {
    setup('#ff0000')
    tab('HSL')
    const [h, s, l] = screen.getAllByRole('textbox') as HTMLInputElement[]
    expect([h.value, s.value, l.value]).toEqual(['0', '100', '50'])
  })

  it('applique une couleur favorite au clic', () => {
    act(() => pinColor('#abcdef'))
    const onChange = setup()
    const favorites = screen.getByText('Favoris').closest('div')!.parentElement!
    fireEvent.click(within(favorites).getByRole('button', { name: '#ABCDEF' }))
    expect(onChange).toHaveBeenLastCalledWith('#abcdef')
  })

  it('une couleur validée rejoint les récentes, et peut être épinglée', () => {
    const Probe = () => <span data-testid="recent">{useColorSwatches().recent.join(',')}</span>
    const onChange = vi.fn()
    render(<><ColorPicker value="#ff6b4a" onChange={onChange} /><Probe /></>)
    open()
    tab('HEX')
    const field = screen.getByLabelText('Valeur hexadécimale')
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: '#0a0b0c' } })
    fireEvent.blur(field)
    expect(screen.getByTestId('recent').textContent).toContain('#0a0b0c')

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter #0A0B0C aux favoris' }))
    expect(screen.getByRole('button', { name: 'Retirer #0A0B0C des favoris' })).toBeTruthy()
  })

  it('affiche les couleurs du projet', () => {
    render(
      <ProjectColorsContext.Provider value={['#123456']}>
        <ColorPicker value="#ff6b4a" onChange={() => {}} />
      </ProjectColorsContext.Provider>,
    )
    open()
    expect(screen.getByText('Du projet')).toBeTruthy()
    expect(screen.getByRole('button', { name: '#123456' })).toBeTruthy()
  })

  it("n'affiche pas la pipette quand le système ne la fournit pas", () => {
    setup()
    expect(screen.queryByRole('button', { name: /Pipette/ })).toBeNull()
  })

  it("applique la couleur prélevée par la pipette", async () => {
    ;(window as unknown as { EyeDropper: unknown }).EyeDropper = class {
      open() { return Promise.resolve({ sRGBHex: '#123456' }) }
    }
    const onChange = setup()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Pipette/ })) })
    expect(onChange).toHaveBeenLastCalledWith('#123456')
  })

  it("une pipette annulée ne change rien", async () => {
    ;(window as unknown as { EyeDropper: unknown }).EyeDropper = class {
      open() { return Promise.reject(new DOMException('annulé', 'AbortError')) }
    }
    const onChange = setup()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Pipette/ })) })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('sans couleur, le champ large affiche « transparent » et le blanc par défaut est applicable', () => {
    const onChange = vi.fn()
    render(<ColorPicker wide value="" onChange={onChange} label="Fond" />)
    expect(screen.getByText('transparent')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fond' }))
    tab('HEX')
    const field = screen.getByLabelText('Valeur hexadécimale')
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: '#ffffff' } })
    // Même valeur que le blanc de départ : elle doit quand même être posée.
    expect(onChange).toHaveBeenLastCalledWith('#ffffff')
  })
})
