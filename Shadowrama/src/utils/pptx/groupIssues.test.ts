import { describe, expect, it } from 'vitest'
import { formatSlideRanges, groupImportIssues } from './groupIssues'

describe('groupImportIssues', () => {
  it('regroupe un même message sur plusieurs diapositives', () => {
    const groups = groupImportIssues([
      { slide: 1, message: 'Recadrage.' },
      { slide: 2, message: 'Recadrage.' },
      { slide: 2, message: 'Tableau ignoré.' },
      { slide: 4, message: 'Recadrage.' },
    ])
    expect(groups).toEqual([
      { message: 'Recadrage.', slides: [1, 2, 4] },
      { message: 'Tableau ignoré.', slides: [2] },
    ])
  })

  it('garde les remarques globales, sans diapositive', () => {
    expect(groupImportIssues([{ slide: null, message: 'Global.' }]))
      .toEqual([{ message: 'Global.', slides: [] }])
  })

  it('trie les diapositives et supprime les doublons', () => {
    const [group] = groupImportIssues([
      { slide: 5, message: 'M' }, { slide: 2, message: 'M' }, { slide: 5, message: 'M' },
    ])
    expect(group.slides).toEqual([2, 5])
  })

  it('ne renvoie rien sans remarque', () => {
    expect(groupImportIssues([])).toEqual([])
  })
})

describe('formatSlideRanges', () => {
  it('abrège les suites consécutives', () => {
    expect(formatSlideRanges([1, 2, 3, 5, 8, 9])).toBe('1-3, 5, 8-9')
    expect(formatSlideRanges([4])).toBe('4')
    expect(formatSlideRanges([])).toBe('')
  })
})