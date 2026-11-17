import { describe, expect, it } from 'vitest'
import type { SlideBackground } from '../types'
import { creamInkFor } from './textContrast'

const NOIR_CREME = '#1c1814'
const BLANC_CREME = '#f4ede0'

const solid = (color: string): SlideBackground => ({ type: 'color', color })

describe('creamInkFor', () => {
  it('noir crème sur un fond clair', () => {
    expect(creamInkFor(solid('#faf6ec'), false)).toBe(NOIR_CREME)
    expect(creamInkFor(solid('#ffffff'), false)).toBe(NOIR_CREME)
  })

  it('blanc crème sur un fond sombre', () => {
    expect(creamInkFor(solid('#1f1b17'), false)).toBe(BLANC_CREME)
    expect(creamInkFor(solid('#000000'), false)).toBe(BLANC_CREME)
  })

  it('suit la luminance et non la teinte : un fond moyen-clair reste foncé dessus', () => {
    expect(creamInkFor(solid('#c8c8c8'), false)).toBe(NOIR_CREME)
  })

  it('donne la teinte inverse quand on la demande (bordure)', () => {
    expect(creamInkFor(solid('#faf6ec'), false, true)).toBe(BLANC_CREME)
    expect(creamInkFor(solid('#1f1b17'), false, true)).toBe(NOIR_CREME)
  })

  it('retombe sur le blanc crème quand le fond est une image (contenu inconnu)', () => {
    const image: SlideBackground = { type: 'image', image: 'media/x.png' }
    expect(creamInkFor(image, true)).toBe(BLANC_CREME)
  })
})
