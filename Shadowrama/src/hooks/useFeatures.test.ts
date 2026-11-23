import { describe, expect, it } from 'vitest'
import { parseFeatures } from './useFeatures'

describe('parseFeatures', () => {
  it('verrouille tout par défaut', () => {
    expect(parseFeatures(null)).toEqual({ alignment: false, chart: false })
    expect(parseFeatures('')).toEqual({ alignment: false, chart: false })
  })

  it('déverrouille chaque fonctionnalité indépendamment', () => {
    expect(parseFeatures('{"chart":true}')).toEqual({ alignment: false, chart: true })
    expect(parseFeatures('{"alignment":true,"chart":true}')).toEqual({ alignment: true, chart: true })
  })

  it("ne déverrouille que sur un « true » explicite", () => {
    expect(parseFeatures('{"alignment":true}')).toEqual({ alignment: true, chart: false })
    expect(parseFeatures('{"alignment":"true"}')).toEqual({ alignment: false, chart: false })
    expect(parseFeatures('{"alignment":1}')).toEqual({ alignment: false, chart: false })
  })

  it('ignore les clés inconnues', () => {
    expect(parseFeatures('{"nimporte":true}')).toEqual({ alignment: false, chart: false })
  })

  it('reste verrouillé quand le stockage est corrompu', () => {
    expect(parseFeatures('{pas du json')).toEqual({ alignment: false, chart: false })
    expect(parseFeatures('42')).toEqual({ alignment: false, chart: false })
    expect(parseFeatures('null')).toEqual({ alignment: false, chart: false })
  })
})
