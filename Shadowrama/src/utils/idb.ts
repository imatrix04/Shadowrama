/**
 * Accès partagé à la base IndexedDB de l'application.
 *
 * Deux magasins y cohabitent — les médias et le brouillon — et ils doivent
 * ouvrir la MÊME base : deux `indexedDB.open` concurrents sur des versions
 * différentes se bloquent mutuellement. Les créations de magasins sont donc
 * centralisées dans un unique `onupgradeneeded`.
 */

const DB_NAME = 'shadowrama'
// v1 : magasin `media` seul (médias en base64).
// v2 : ajout du magasin `draft` — le brouillon vivait dans localStorage, dont le
//      plafond de quelques mégaoctets était atteint par un projet illustré, et
//      dont l'écriture synchrone bloquait le thread principal toutes les 500 ms.
const DB_VERSION = 2

export const MEDIA_STORE = 'media'
export const DRAFT_STORE = 'draft'

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        db.createObjectStore(MEDIA_STORE, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        db.createObjectStore(DRAFT_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => {
      const db = request.result
      // Une connexion gardée ouverte bloquerait la montée de version demandée
      // par une autre fenêtre. On se retire, et la prochaine opération rouvrira.
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      resolve(db)
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Connexion unique, gardée ouverte pour toute la session.
 *
 * La version précédente ouvrait et refermait la base à chaque opération. Avec
 * une autosauvegarde toutes les 500 ms, ça multipliait les ouvertures — et une
 * fermeture pendant qu'une autre transaction démarre fait échouer cette
 * dernière.
 */
export function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = open().catch(err => {
      // Un échec ne doit pas être mis en cache : la tentative suivante doit
      // pouvoir réessayer (base bloquée par un autre onglet, par exemple).
      dbPromise = null
      throw err
    })
  }
  return dbPromise
}

/** Exécute une requête dans une transaction, et résout sur la fin de celle-ci. */
export function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const request = run(tx.objectStore(storeName))
    let result: T
    request.onsuccess = () => { result = request.result }
    // On attend `oncomplete` et non `onsuccess` : en écriture, la donnée n'est
    // durable qu'une fois la transaction validée.
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error ?? request.error)
    tx.onabort = () => reject(tx.error ?? request.error)
  }))
}
