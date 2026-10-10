/**
 * Petits outils de lecture du XML OOXML (PowerPoint).
 *
 * On s'appuie sur `DOMParser`, déjà présent dans le renderer (et dans jsdom pour
 * les tests) : aucune dépendance de plus. Les préfixes d'espace de noms (`p:`,
 * `a:`, `r:`) variant d'un logiciel à l'autre, tout se compare sur le nom local.
 */

export function parseXml(text: string): Element {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const root = doc.documentElement
  if (!root || root.localName === 'parsererror' || doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('XML illisible')
  }
  return root
}

/** Enfants directs portant l'un des noms locaux donnés (tous si aucun nom). */
export function kids(el: Element | null | undefined, ...names: string[]): Element[] {
  if (!el) return []
  const out: Element[] = []
  for (const child of Array.from(el.children)) {
    if (names.length === 0 || names.includes(child.localName)) out.push(child)
  }
  return out
}

export function kid(el: Element | null | undefined, name: string): Element | null {
  if (!el) return null
  for (const child of Array.from(el.children)) {
    if (child.localName === name) return child
  }
  return null
}

/** Descend un chemin de noms locaux : `path(el, 'nvSpPr', 'nvPr', 'ph')`. */
export function path(el: Element | null | undefined, ...names: string[]): Element | null {
  let current: Element | null | undefined = el
  for (const name of names) {
    current = kid(current, name)
    if (!current) return null
  }
  return current ?? null
}

/** Tous les descendants portant ce nom local. */
export function descendants(el: Element | null | undefined, name: string): Element[] {
  if (!el) return []
  return Array.from(el.getElementsByTagName('*')).filter(e => e.localName === name)
}

export function attr(el: Element | null | undefined, name: string): string | undefined {
  if (!el) return undefined
  // Un attribut sans préfixe prime : `<p:sldId id="256" r:id="rId2"/>` en porte deux
  // de même nom local, dont seul le premier est le « vrai » `id`.
  const plain = el.getAttribute(name)
  if (plain !== null) return plain
  for (const a of Array.from(el.attributes)) {
    if (a.localName === name) return a.value
  }
  return undefined
}

const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

/** Attribut de l'espace de noms des relations (`r:id`, `r:embed`). */
export function relAttr(el: Element | null | undefined, name: string): string | undefined {
  return el?.getAttributeNS(REL_NS, name) ?? undefined
}

export function numAttr(el: Element | null | undefined, name: string): number | undefined {
  const raw = attr(el, name)
  if (raw === undefined || raw === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

export function boolAttr(el: Element | null | undefined, name: string): boolean | undefined {
  const raw = attr(el, name)
  if (raw === undefined) return undefined
  return raw === '1' || raw === 'true'
}