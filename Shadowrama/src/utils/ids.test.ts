import { describe, expect, it } from 'vitest'
import { nextId } from './ids'

describe('nextId', () => {
  // `Date.now()` seul provoquait des collisions dès que deux blocs étaient créés
  // dans la même milliseconde — duplication de diapositive, collage multiple.
  it('rend mille identifiants distincts daffilée', () => {
    const ids = new Set<number>()
    for (let i = 0; i < 1000; i++) ids.add(nextId())

    expect(ids.size).toBe(1000)
  })

  it('reste dans les entiers sûrs de JavaScript', () => {
    expect(nextId()).toBeLessThan(Number.MAX_SAFE_INTEGER)
    expect(Number.isSafeInteger(nextId())).toBe(true)
  })

  it('progresse dans le temps', () => {
    const first = nextId()
    const second = nextId()

    expect(second).toBeGreaterThan(first)
  })
})
