import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NUMBERING, formatNumber, normalizeNumbering, slideNumberText, toRoman,
} from './numbering'
import type { SlideNumbering } from '../types'

const on = (changes: Partial<SlideNumbering> = {}): SlideNumbering => ({
  ...DEFAULT_NUMBERING, enabled: true, ...changes,
})

describe('toRoman', () => {
  it('convertit les valeurs usuelles', () => {
    expect(toRoman(1)).toBe('I')
    expect(toRoman(4)).toBe('IV')
    expect(toRoman(9)).toBe('IX')
    expect(toRoman(14)).toBe('XIV')
    expect(toRoman(1994)).toBe('MCMXCIV')
  })

  it('reste sûr hors bornes', () => {
    expect(toRoman(0)).toBe('0')
    expect(toRoman(-3)).toBe('0')
    expect(toRoman(NaN)).toBe('0')
  })
})

describe('formatNumber', () => {
  it('applique chaque format', () => {
    expect(formatNumber(3, 12, 'n')).toBe('3')
    expect(formatNumber(3, 12, 'nn')).toBe('03')
    expect(formatNumber(3, 12, 'n-total')).toBe('3 / 12')
    expect(formatNumber(3, 12, 'roman')).toBe('III')
  })
})

describe('slideNumberText', () => {
  it("n'affiche rien quand la numérotation est coupée", () => {
    expect(slideNumberText(0, 5, DEFAULT_NUMBERING)).toBeNull()
  })

  it('numérote à partir de 1 par défaut', () => {
    expect(slideNumberText(0, 5, on())).toBe('1')
    expect(slideNumberText(4, 5, on())).toBe('5')
  })

  it('respecte le numéro de départ, y compris dans le total', () => {
    expect(slideNumberText(0, 5, on({ startAt: 10, format: 'n-total' }))).toBe('10 / 14')
  })

  it('saute la première diapositive sans décaler les suivantes', () => {
    const n = on({ skipFirst: true })
    expect(slideNumberText(0, 5, n)).toBeNull()
    expect(slideNumberText(1, 5, n)).toBe('2')
  })
})

describe('normalizeNumbering', () => {
  it('retombe sur les défauts quand la donnée est absente ou illisible', () => {
    expect(normalizeNumbering(undefined)).toEqual(DEFAULT_NUMBERING)
    expect(normalizeNumbering('x')).toEqual(DEFAULT_NUMBERING)
    expect(normalizeNumbering(null)).toEqual(DEFAULT_NUMBERING)
  })

  it('ne garde que des valeurs valides', () => {
    const n = normalizeNumbering({
      enabled: true, format: 'bidon', position: 'nulle-part', size: 9999,
      opacity: -2, startAt: 3.7, bold: 'oui', color: 42,
    })
    expect(n.enabled).toBe(true)
    expect(n.format).toBe(DEFAULT_NUMBERING.format)
    expect(n.position).toBe(DEFAULT_NUMBERING.position)
    expect(n.size).toBe(120)
    expect(n.opacity).toBe(0.05)
    expect(n.startAt).toBe(4)
    expect(n.bold).toBe(false)
    expect(n.color).toBeUndefined()
  })

  it("conserve et borne une animation, mode manuel compris", () => {
    const n = normalizeNumbering({
      enabled: true,
      animation: { preset: 'custom', speed: 99, custom: { from: { opacity: 5, x: 'a' }, duration: 0 } },
    })
    expect(n.animation?.preset).toBe('custom')
    expect(n.animation?.speed).toBe(3)
    expect(n.animation?.custom?.from).toEqual({ opacity: 1 })
    expect(n.animation?.custom?.duration).toBe(0.1)
    expect(n.animation?.custom?.ease).toBe('power2.out')
  })

  it('ignore une animation sans preset', () => {
    expect(normalizeNumbering({ animation: { speed: 2 } }).animation).toBeUndefined()
  })
})