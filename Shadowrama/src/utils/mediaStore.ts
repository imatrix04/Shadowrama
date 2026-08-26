import { MEDIA_STORE, withStore } from './idb'

interface MediaEntry {
  blobUrl: string
  /** Octets bruts de l'image. */
  bytes: Uint8Array
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

function createBlobUrl(bytes: Uint8Array, mimeType: string): string {
  // `slice()` détache la vue de son tampon d'origine : un Blob construit sur une
  // vue partagée resterait solidaire du tampon complet.
  return URL.createObjectURL(new Blob([bytes.slice()], { type: mimeType }))
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
    store.set(entry.key, {
      blobUrl: createBlobUrl(bytes, entry.mimeType),
      bytes,
      mimeType: entry.mimeType,
    })
  }
}

export function registerMedia(key: string, bytes: Uint8Array, mimeType: string): string {
  const blobUrl = createBlobUrl(bytes, mimeType)
  store.set(key, { blobUrl, bytes, mimeType })
  // Persistance opportuniste : un échec d'écriture IndexedDB ne doit pas
  // empêcher l'insertion de l'image dans la diapo en cours.
  void withStore(MEDIA_STORE, 'readwrite', s => s.put({ key, bytes, mimeType })).catch(() => {})
  return blobUrl
}

export function resolveMedia(key: string): string | undefined {
  return store.get(key)?.blobUrl
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
export function getAllMediaForSave(usedKeys: Set<string>): { key: string; data: Uint8Array }[] {
  const out: { key: string; data: Uint8Array }[] = []
  for (const [key, entry] of store) {
    if (usedKeys.has(key)) out.push({ key, data: entry.bytes })
  }
  return out
}

export function generateMediaKey(originalName: string): string {
  // `split('.').pop()` rendait le nom ENTIER quand il ne contient aucun point :
  // un fichier « photo » donnait la clé « …-photo ». L'extension est aussi
  // ramenée en minuscules — `guessMimeType` compare des suffixes en minuscules,
  // si bien qu'un « IMG.JPG » était typé `application/octet-stream` et ne
  // réapparaissait pas à la réouverture du projet.
  const match = /\.([a-z0-9]+)$/i.exec(originalName)
  const ext = match ? match[1].toLowerCase() : 'png'
  return `media/img-${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`
}
