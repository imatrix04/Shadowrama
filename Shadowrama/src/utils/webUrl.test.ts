import { describe, expect, it } from 'vitest'
import { normalizeWebUrl, sanitizeWebUrl, webUrlHost } from './webUrl'

describe('normalizeWebUrl', () => {
  it('ajoute https:// à un nom de domaine', () => {
    expect(normalizeWebUrl('youtube.com')).toBe('https://youtube.com/')
    expect(normalizeWebUrl('  www.example.org/a?b=1  ')).toBe('https://www.example.org/a?b=1')
  })

  it('garde une adresse complète telle quelle', () => {
    expect(normalizeWebUrl('https://example.com/page')).toBe('https://example.com/page')
    expect(normalizeWebUrl('http://example.com')).toBe('http://example.com/')
  })

  it('prend http:// pour une machine locale sans schéma', () => {
    expect(normalizeWebUrl('localhost:3000')).toBe('http://localhost:3000/')
    expect(normalizeWebUrl('localhost')).toBe('http://localhost/')
    expect(normalizeWebUrl('127.0.0.1:5173/app')).toBe('http://127.0.0.1:5173/app')
    expect(normalizeWebUrl('192.168.1.20:8080')).toBe('http://192.168.1.20:8080/')
    expect(normalizeWebUrl('mon-nas.local')).toBe('http://mon-nas.local/')
  })

  it('accepte un hôte avec port même sans point', () => {
    expect(normalizeWebUrl('monserveur:8080')).toBe('http://monserveur:8080/')
  })

  it('respecte https:// explicite vers localhost', () => {
    expect(normalizeWebUrl('https://localhost:3000')).toBe('https://localhost:3000/')
  })

  it('refuse tout ce qui n’est pas une page web', () => {
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,<h1>x</h1>',
      'file:///etc/passwd',
      'ftp://example.com',
      'chrome://settings',
      'about:blank',
      'blob:https://example.com/abc',
      '//example.com',
    ]) {
      expect(normalizeWebUrl(bad), bad).toBeNull()
    }
  })

  it('refuse le vide, les espaces et les types étrangers', () => {
    expect(normalizeWebUrl('')).toBeNull()
    expect(normalizeWebUrl('   ')).toBeNull()
    expect(normalizeWebUrl('deux mots')).toBeNull()
    expect(normalizeWebUrl(42)).toBeNull()
    expect(normalizeWebUrl(undefined)).toBeNull()
  })

  it('refuse un nom sans point ni port', () => {
    expect(normalizeWebUrl('youtube')).toBeNull()
  })
})

describe('sanitizeWebUrl', () => {
  it('renvoie une chaîne vide pour une valeur inutilisable', () => {
    expect(sanitizeWebUrl('javascript:alert(1)')).toBe('')
    expect(sanitizeWebUrl(null)).toBe('')
    expect(sanitizeWebUrl('example.com')).toBe('https://example.com/')
  })
})

describe('webUrlHost', () => {
  it('extrait l’hôte', () => {
    expect(webUrlHost('http://localhost:3000/x')).toBe('localhost:3000')
    expect(webUrlHost('pas une url')).toBe('pas une url')
  })
})