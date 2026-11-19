import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Slide } from '../types'
import { MAX_TURNS, runAssistant } from './session'
import type { SessionOptions } from './session'
import type { ContentBlock, TurnResult, WireMessage } from './types'

const toolUse = (id: string, name: string, input: unknown): ContentBlock =>
  ({ type: 'tool_use', id, name, input: input as Record<string, unknown> })

function setup(turns: TurnResult[]) {
  const sent: WireMessage[][] = []
  let call = 0
  const turn = vi.fn(async (req: { messages: WireMessage[] }) => {
    sent.push(structuredClone(req.messages))
    return turns[Math.min(call++, turns.length - 1)]
  })
  const abort = vi.fn()
  ;(window as unknown as { aiAPI: unknown }).aiAPI = { turn, abort }
  return { turn, abort, sent }
}

const baseOptions = (over: Partial<SessionOptions> = {}): SessionOptions => ({
  provider: 'anthropic',
  history: [],
  userText: 'Ajoute un titre',
  slides: [{ id: 1, blocks: [] }] as Slide[],
  editor: { currentSlide: 0, selectedIds: [], ultra: false },
  onSlides: vi.fn(),
  onFocusSlide: vi.fn(),
  onEvent: vi.fn(),
  signal: new AbortController().signal,
  ...over,
})

afterEach(() => { delete (window as unknown as { aiAPI?: unknown }).aiAPI })

describe('runAssistant', () => {
  it('exécute les outils, renvoie leurs résultats au modèle puis conclut', async () => {
    const { sent } = setup([
      { ok: true, stopReason: 'tool_use', content: [toolUse('t1', 'add_block', { slide: 1, type: 'title', props: { content: 'Salut' } })] },
      { ok: true, stopReason: 'end', content: [{ type: 'text', text: 'Fait.' }] },
    ])
    const options = baseOptions()
    const result = await runAssistant(options)

    expect(result.end).toBe('done')
    expect(options.onSlides).toHaveBeenCalledTimes(1)
    const slides = (options.onSlides as ReturnType<typeof vi.fn>).mock.calls[0][0] as Slide[]
    expect(slides[0].blocks).toHaveLength(1)

    // Le 2e appel contient le résultat de l'outil, associé au bon identifiant.
    const last = sent[1][sent[1].length - 1]
    expect(last.content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 't1', is_error: false })
    // Le contexte de l'éditeur accompagne le message de l'utilisateur.
    expect(JSON.stringify(sent[0][0])).toContain('Contexte de l')
  })

  it("garde l'historique réduit au texte pour la demande suivante", async () => {
    setup([
      { ok: true, stopReason: 'tool_use', content: [toolUse('t1', 'get_project', {})] },
      { ok: true, stopReason: 'end', content: [{ type: 'text', text: 'Il y a 1 diapositive.' }] },
    ])
    const result = await runAssistant(baseOptions({ userText: 'Combien ?' }))
    expect(result.history).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'Combien ?' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Il y a 1 diapositive.' }] },
    ])
  })

  it('renvoie une erreur de outil au modèle sans toucher aux diapositives', async () => {
    const { sent } = setup([
      { ok: true, stopReason: 'tool_use', content: [toolUse('t1', 'add_block', { slide: 1, type: 'hologramme' })] },
      { ok: true, stopReason: 'end', content: [{ type: 'text', text: 'Impossible.' }] },
    ])
    const options = baseOptions()
    await runAssistant(options)
    expect(options.onSlides).not.toHaveBeenCalled()
    expect(sent[1][sent[1].length - 1].content[0]).toMatchObject({ is_error: true })
  })

  it('relaie la réponse en direct, ignore les autres demandes et coupe l’écoute à la fin', async () => {
    const listeners: Array<(d: unknown) => void> = []
    const stop = vi.fn()
    let requestId = ''
    const turn = vi.fn(async (req: { requestId: string }) => {
      requestId = req.requestId
      // Des morceaux arrivent pendant l'appel : deux pour cette demande, un pour une autre.
      for (const l of listeners) {
        l({ requestId, type: 'text', text: 'Bon' })
        l({ requestId: 'autre', type: 'text', text: 'PARASITE' })
        l({ requestId, type: 'text', text: 'jour' })
        l({ requestId, type: 'tool', name: 'get_project' })
      }
      return { ok: true, stopReason: 'end', content: [{ type: 'text', text: 'Bonjour' }] } as TurnResult
    })
    ;(window as unknown as { aiAPI: unknown }).aiAPI = {
      turn, abort: vi.fn(),
      onDelta: (cb: (d: unknown) => void) => { listeners.push(cb); return stop },
    }
    const options = baseOptions()
    await runAssistant(options)
    const events = (options.onEvent as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0])
    expect(events).toEqual([
      { type: 'stream', text: 'Bon' },
      { type: 'stream', text: 'Bonjour' },
      { type: 'text', text: 'Bonjour' },
    ])
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it("s'arrête sur une erreur du fournisseur et la rapporte", async () => {
    setup([{ ok: false, error: 'Clé API refusée' }])
    const result = await runAssistant(baseOptions())
    expect(result).toMatchObject({ end: 'error', error: 'Clé API refusée' })
  })

  it('transmet l’interruption au processus principal et garde le travail déjà fait', async () => {
    const controller = new AbortController()
    const { abort } = setup([
      { ok: true, stopReason: 'tool_use', content: [toolUse('t1', 'add_slide', {})] },
    ])
    const options = baseOptions({
      signal: controller.signal,
      // L'utilisateur clique sur Stop dès la première modification.
      onSlides: vi.fn(() => controller.abort()),
    })
    const result = await runAssistant(options)
    expect(result.end).toBe('stopped')
    expect(abort).toHaveBeenCalled()
    expect(options.onSlides).toHaveBeenCalledTimes(1)
  })

  it('borne le nombre de tours', async () => {
    const { turn } = setup([
      { ok: true, stopReason: 'tool_use', content: [toolUse('t', 'get_project', {})] },
    ])
    const result = await runAssistant(baseOptions())
    expect(result.end).toBe('limit')
    expect(turn).toHaveBeenCalledTimes(MAX_TURNS)
  })

  it('échoue proprement hors application de bureau', async () => {
    const result = await runAssistant(baseOptions())
    expect(result.end).toBe('error')
  })
})
