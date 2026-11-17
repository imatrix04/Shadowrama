import { MEDIA_STORE, withStore } from './idb'

interface MediaEntry {
  blobUrl: string
  /**
   * Contenu du média. On garde le Blob et NON les octets : conserver les deux
   * doublait l'empreinte mémoire de chaque fichier (une vidéo de 300 Mo en
   * occupait 600), alors que Chromium sait décharger un gros Blob sur disque.
   * Les octets ne sont relus qu'au moment d'enregistrer le projet.
   */
  blob: Blob
  mimeType: string
}

// Cache en mémoire : c'est lui qui est lu pendant le rendu (`resolveMedia`),
// il doit donc rester synchrone. IndexedDB ne sert qu'à le reconstruire au
// démarrage — sans ça, le brouillon restauré référence des médias disparus et
// tous les blocs image retombent sur le placeholder.
//
// Les octets sont stockés en binaire et non en base64. L'ancien format gardait
// la même image trois fois (base64 en mémoire, Blob pour l'affichage, base64 en
// base) et repassait par un `atob` caractère par caractère à chaque démarrage :
// une trentaine de photos suffisaient à faire ramer l'ouverture.
const store = new Map<string, MediaEntry>()

interface PersistedMedia {
  key: string
  bytes?: Uint8Array
  /** Format hérité des versions ≤ 0.15 : converti à la lecture. */
  base64?: string
  mimeType: string
}

function createEntry(bytes: Uint8Array, mimeType: string): MediaEntry {
  // `slice()` détache la vue de son tampon d'origine : un Blob construit sur une
  // vue partagée resterait solidaire du tampon complet.
  const blob = new Blob([bytes.slice()], { type: mimeType })
  return { blobUrl: URL.createObjectURL(blob), blob, mimeType }
}

/** Décode le format hérité (base64) vers des octets bruts. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Recharge les médias persistés dans le cache mémoire.
 * À appeler une fois au démarrage de l'éditeur, AVANT le premier rendu des blocs.
 */
export async function hydrateMediaStore(): Promise<void> {
  let persisted: PersistedMedia[]
  try {
    persisted = await withStore<PersistedMedia[]>(MEDIA_STORE, 'readonly', s => s.getAll() as IDBRequest<PersistedMedia[]>)
  } catch {
    // IndexedDB indisponible : on dégrade en cache purement mémoire.
    return
  }
  for (const entry of persisted) {
    if (store.has(entry.key)) continue
    // Les entrées écrites par une version antérieure sont en base64 : on les
    // convertit à la volée plutôt que de vider la base, sinon le brouillon en
    // cours perdrait ses images à la première mise à jour.
    const bytes = entry.bytes ?? (entry.base64 ? base64ToBytes(entry.base64) : undefined)
    if (!bytes) continue
    store.set(entry.key, createEntry(bytes, entry.mimeType))
  }
}

export function registerMedia(key: string, bytes: Uint8Array, mimeType: string): string {
  // Réenregistrer sous la même clé remplace le média : l'ancienne URL ne doit
  // pas retenir son Blob en mémoire.
  const previous = store.get(key)
  if (previous) URL.revokeObjectURL(previous.blobUrl)
  const entry = createEntry(bytes, mimeType)
  store.set(key, entry)
  // Persistance opportuniste : un échec d'écriture IndexedDB ne doit pas
  // empêcher l'insertion de l'image dans la diapo en cours.
  void withStore(MEDIA_STORE, 'readwrite', s => s.put({ key, bytes, mimeType })).catch(() => {})
  return entry.blobUrl
}

export function resolveMedia(key: string): string | undefined {
  return store.get(key)?.blobUrl
}

/** Contenu d'un média, pour qui a besoin des octets (export PowerPoint). */
export function getMediaBlob(key: string): Blob | undefined {
  return store.get(key)?.blob
}

export function clearMediaStore() {
  for (const entry of store.values()) URL.revokeObjectURL(entry.blobUrl)
  store.clear()
  void withStore(MEDIA_STORE, 'readwrite', s => s.clear()).catch(() => {})
}

/**
 * Médias à écrire dans le `.shma`, restreints à ceux encore référencés.
 *
 * Le filtrage est volontairement NON destructif : le store garde les médias que
 * plus aucun bloc n'utilise. Une version antérieure les supprimait ici même, si
 * bien que supprimer une image puis enregistrer puis annuler ramenait un bloc
 * dont le média avait disparu du cache ET d'IndexedDB — une perte de données
 * qu'un Ctrl+Z est censé justement empêcher. Le fichier, lui, ne contient bien
 * que ce qui sert : il ne grossit pas.
 */
export async function getAllMediaForSave(usedKeys: Set<string>): Promise<{ key: string; data: Uint8Array }[]> {
  const out: { key: string; data: Uint8Array }[] = []
  for (const [key, entry] of store) {
    if (usedKeys.has(key)) out.push({ key, data: new Uint8Array(await entry.blob.arrayBuffer()) })
  }
  return out
}

/**
 * Supprime les médias que plus rien ne référence — du cache ET d'IndexedDB.
 *
 * À n'appeler qu'au démarrage de l'éditeur, quand l'historique d'annulation est
 * vide : c'est le seul moment où « non référencé » veut vraiment dire « perdu
 * pour de bon ». En cours de session, un Ctrl+Z peut encore ramener un bloc
 * supprimé (voir `getAllMediaForSave`). Sans cette purge, les médias orphelins
 * s'accumulaient en base de session en session, tant que l'utilisateur
 * n'ouvrait pas un autre projet.
 */
export function pruneMediaStore(usedKeys: Set<string>) {
  for (const [key, entry] of store) {
    if (usedKeys.has(key)) continue
    URL.revokeObjectURL(entry.blobUrl)
    store.delete(key)
    void withStore(MEDIA_STORE, 'readwrite', s => s.delete(key)).catch(() => {})
  }
}

export function generateMediaKey(originalName: string, kind: 'img' | 'vid' = 'img'): string {
  // `split('.').pop()` rendait le nom ENTIER quand il ne contient aucun point :
  // un fichier « photo » donnait la clé « …-photo ». L'extension est aussi
  // ramenée en minuscules — `guessMimeType` compare des suffixes en minuscules,
  // si bien qu'un « IMG.JPG » était typé `application/octet-stream` et ne
  // réapparaissait pas à la réouverture du projet.
  const match = /\.([a-z0-9]+)$/i.exec(originalName)
  const ext = match ? match[1].toLowerCase() : (kind === 'vid' ? 'mp4' : 'png')
  // Identifiant aléatoire de 122 bits : `Date.now()` suivi d'un nombre entre 0
  // et 999 pouvait donner deux fois la même clé à deux fichiers importés dans la
  // même milliseconde (sélection multiple d'un carrousel) — le second écrasait
  // alors le premier.
  return `media/${kind}-${crypto.randomUUID()}.${ext}`
}
