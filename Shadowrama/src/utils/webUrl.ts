/**
 * Adresses du bloc « Page web ».
 *
 * Source de vérité unique pour tout ce qui entre dans le bloc : la barre
 * d'adresse, le champ du menu contextuel et la lecture d'un projet. Seuls
 * `http:` et `https:` passent — un `.shma` ouvert depuis l'extérieur ne doit
 * jamais pouvoir faire charger `file:`, `javascript:` ou `data:` par le bloc.
 */

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i
const EXPLICIT_WEB = /^https?:\/\//i
// `localhost:3000` ressemble à un schéma « localhost: » : on le reconnaît avant.
const HOST_WITH_PORT = /^(?:\[[0-9a-f:]+\]|[^\s/:?#]+):\d{1,5}(?:[/?#]|$)/i
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/

/** Serveur de la machine ou du réseau local : pas de HTTPS à attendre. */
function isLocalHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
  if (host === '::1' || host === '0.0.0.0') return true
  if (IPV4.test(host)) return true
  return false
}

/**
 * Transforme ce que l'utilisateur a tapé en adresse chargeable, ou `null` si ce
 * n'est pas une page web.
 *
 *   « youtube.com »        → https://youtube.com/
 *   « localhost:3000 »     → http://localhost:3000/
 *   « 192.168.1.20:8080 »  → http://192.168.1.20:8080/
 *   « javascript:alert(1) » → null
 */
export function normalizeWebUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = raw.trim()
  if (!text || /\s/.test(text)) return null

  let candidate: string
  if (EXPLICIT_WEB.test(text)) {
    candidate = text
  } else if (HOST_WITH_PORT.test(text)) {
    candidate = `http://${text}`
  } else if (HAS_SCHEME.test(text) || text.startsWith('//')) {
    return null
  } else {
    candidate = `https://${text}`
  }

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  const host = url.hostname
  if (!host) return null

  const bare = !text.match(EXPLICIT_WEB)
  if (bare && isLocalHost(host)) {
    // Adresse sans schéma vers une machine locale : http, comme dans un navigateur.
    url.protocol = 'http:'
  }

  // Un nom sans point (« youtube ») n'est ni un site ni une machine locale :
  // le charger afficherait une erreur de résolution, autant le dire tout de suite.
  const known = host.includes('.') || isLocalHost(host) || host.startsWith('[')
  const hasPort = HOST_WITH_PORT.test(text.replace(EXPLICIT_WEB, ''))
  if (!known && !hasPort) return null

  return url.toString()
}

/** Lecture défensive : l'adresse enregistrée, ou une chaîne vide si inutilisable. */
export function sanitizeWebUrl(raw: unknown): string {
  return normalizeWebUrl(raw) ?? ''
}

/** « www.youtube.com » pour https://www.youtube.com/watch?v=… — pour les aperçus. */
export function webUrlHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}