import { describe, expect, it } from 'vitest'
import { parseFeatures } from './useFeatures'

describe('parseFeatures', () => {
  it('verrouille tout par défaut', () => {
    expect(parseFeatures(null)).toEqual({ alignment: false })
    expect(parseFeatures('')).toEqual({ alignment: false })
  })

  it("ne déverrouille que sur un « true » explicite", () => {
    expect(parseFeatures('{"alignment":true}')).toEqual({ alignment: true })
    expect(parseFeatures('{"alignment":"true"}')).toEqual({ alignment: false })
    expect(parseFeatures('{"alignment":1}')).toEqual({ alignment: false })
  })

  it('ignore les clés inconnues', () => {
    expect(parseFeatures('{"nimporte":true}')).toEqual({ alignment: false })
  })

  it('reste verrouillé quand le stockage est corrompu', () => {
    expect(parseFeatures('{pas du json')).toEqual({ alignment: false })
    expect(parseFeatures('42')).toEqual({ alignment: false })
    expect(parseFeatures('null')).toEqual({ alignment: false })
  })
})
