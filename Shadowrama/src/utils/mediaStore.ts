interface MediaEntry {
  blobUrl: string
  base64: string // sans préfixe data:, juste le payload
  mimeType: string
}

// Cache en mémoire : c'est lui qui est lu pendant le rendu (`resolveMedia`),
// il doit donc rester synchrone. IndexedDB ne sert qu'à le reconstruire au
// démarrage — sans ça, le brouillon restauré référence des médias disparus et
// tous les blocs image retombent sur le placeholder.
const store = new Map<string, MediaEntry>()

const DB_NAME = 'shadowrama'
const DB_VERSION = 1
const STORE_NAME = 'media'

interface PersistedMedia {
  key: string
  base64: string
  mimeType: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const request = run(tx.objectStore(STORE_NAME))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
  })
}

function createBlobUrl(base64: string, mimeType: string): string {
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }))
}

/**
 * Recharge les médias persistés dans le cache mémoire.
 * À appeler une fois au démarrage de l'éditeur, AVANT le premier rendu des blocs.
 */
export async function hydrateMediaStore(): Promise<void> {
  let persisted: PersistedMedia[]
  try {
    persisted = await withStore<PersistedMedia[]>('readonly', s => s.getAll() as IDBRequest<PersistedMedia[]>)
  } catch {
    // IndexedDB indisponible : on dégrade en cache purement mémoire.
    return
  }
  for (const entry of persisted) {
    if (store.has(entry.key)) continue
    store.set(entry.key, {
      blobUrl: createBlobUrl(entry.base64, entry.mimeType),
      base64: entry.base64,
      mimeType: entry.mimeType,
    })
  }
}

export function registerMedia(key: string, base64: string, mimeType: string): string {
  const blobUrl = createBlobUrl(base64, mimeType)
  store.set(key, { blobUrl, base64, mimeType })
  // Persistance opportuniste : un échec d'écriture IndexedDB ne doit pas
  // empêcher l'insertion de l'image dans la diapo en cours.
  void withStore('readwrite', s => s.put({ key, base64, mimeType })).catch(() => {})
  return blobUrl
}

export function resolveMedia(key: string): string | undefined {
  return store.get(key)?.blobUrl
}

export function clearMediaStore() {
  for (const entry of store.values()) URL.revokeObjectURL(entry.blobUrl)
  store.clear()
  void withStore('readwrite', s => s.clear()).catch(() => {})
}

/**
 * Supprime les médias qu'aucun bloc ne référence plus.
 * Sans ça, une image supprimée continue d'être réécrite dans le .shma à chaque
 * sauvegarde et le fichier grossit indéfiniment.
 */
export function pruneMedia(usedKeys: Set<string>) {
  for (const [key, entry] of store) {
    if (usedKeys.has(key)) continue
    URL.revokeObjectURL(entry.blobUrl)
    store.delete(key)
    void withStore('readwrite', s => s.delete(key)).catch(() => {})
  }
}

export function getAllMediaForSave(): { key: string; data: string }[] {
  return Array.from(store.entries()).map(([key, entry]) => ({ key, data: entry.base64 }))
}

export function generateMediaKey(originalName: string): string {
  const ext = originalName.split('.').pop() || 'png'
  return `media/img-${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`
}
