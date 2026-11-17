import { dialog, ipcMain } from 'electron'
import { createWriteStream } from 'fs'
import { readFile, rename, rm, stat, writeFile } from 'fs/promises'
import { basename } from 'path'
import { pipeline } from 'stream/promises'
import JSZip from 'jszip'

// Octets bruts. L'ancien format transportait du base64 : +33 % de volume sur
// l'IPC, plus un encodage et un décodage à chaque bout.
interface MediaEntry { key: string; data: Uint8Array }

ipcMain.handle('save-project-as', async (_e, manifestJson: string, media: MediaEntry[], defaultName: string) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: `${defaultName}.shma`,
    filters: [{ name: 'Shadowrama', extensions: ['shma'] }],
  })
  if (canceled || !filePath) return null
  await writeZip(filePath, manifestJson, media)
  return filePath
})

ipcMain.handle('save-project', async (_e, filePath: string, manifestJson: string, media: MediaEntry[]) => {
  assertProjectPath(filePath)
  await writeZip(filePath, manifestJson, media)
  return filePath
})

ipcMain.handle('open-project', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'Shadowrama', extensions: ['shma'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths[0]) return null
  return readProject(filePaths[0])
})

// Ouverture sans boîte de dialogue, pour la liste des projets récents.
ipcMain.handle('open-project-at', async (_e, filePath: string) => {
  assertProjectPath(filePath)
  return readProject(filePath)
})

// Import PowerPoint : la boîte de dialogue reste côté processus principal et seul
// le contenu du fichier choisi traverse l'IPC. Aucun chemin fourni par le
// renderer n'est lu ici, contrairement à `open-project-at`.
const MAX_PPTX_BYTES = 200 * 1024 * 1024

ipcMain.handle('open-pptx', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'PowerPoint', extensions: ['pptx'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths[0]) return null
  const buffer = await readFile(filePaths[0])
  if (buffer.length > MAX_PPTX_BYTES) {
    throw new Error('Ce fichier PowerPoint dépasse 200 Mo et ne peut pas être importé.')
  }
  return { filePath: filePaths[0], data: new Uint8Array(buffer) }
})

// ── Export PowerPoint ───────────────────────────────────────────────────────
// En deux temps : l'utilisateur choisit d'abord l'emplacement (inutile de
// fabriquer le fichier s'il annule), puis le renderer envoie les octets. Le
// chemin choisi reste ICI : le renderer n'en reçoit que le nom, et ne peut donc
// pas faire écrire ailleurs qu'à l'endroit désigné dans la boîte de dialogue.

let pendingPptxPath: string | null = null

ipcMain.handle('pick-pptx-path', async (_e, defaultName: string) => {
  const safeName = String(defaultName ?? '').replace(/[\\/:*?"<>|]/g, '').trim() || 'presentation'
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: `${safeName}.pptx`,
    filters: [{ name: 'PowerPoint', extensions: ['pptx'] }],
  })
  if (canceled || !filePath) return null
  pendingPptxPath = /\.pptx$/i.test(filePath) ? filePath : `${filePath}.pptx`
  return basename(pendingPptxPath)
})

ipcMain.handle('write-pptx', async (_e, data: Uint8Array) => {
  const filePath = pendingPptxPath
  if (!filePath) throw new Error("Aucun emplacement n'a été choisi pour l'export.")
  pendingPptxPath = null
  await writeAtomic(filePath, async tempPath => {
    await writeFile(tempPath, data)
    return data.byteLength
  })
  return basename(filePath)
})

/**
 * Refuse tout chemin qui n'est pas un projet Shadowrama.
 *
 * `open-project-at` et `save-project` prennent un chemin fourni par le renderer,
 * sans boîte de dialogue : sans ce filtre, ils forment une primitive de lecture
 * et d'écriture de fichier arbitraire. L'application ne charge aucun contenu
 * distant, donc le risque reste théorique — mais il suffirait d'une injection
 * dans le renderer pour lire une clé SSH ou un `.env`. Contraindre l'extension
 * ne coûte rien et réduit la surface à des fichiers que l'application produit
 * elle-même.
 */
function assertProjectPath(filePath: string) {
  if (typeof filePath !== 'string' || !/\.shma$/i.test(filePath)) {
    throw new Error('Chemin de projet invalide : un fichier .shma est attendu.')
  }
}

async function readProject(filePath: string) {
  const buffer = await readFile(filePath)
  const zip = await JSZip.loadAsync(buffer)

  const manifestFile = zip.file('manifest.json')
  if (!manifestFile) throw new Error('manifest.json manquant')
  const manifestJson = await manifestFile.async('string')

  // ⚠️ zip.folder('media').files renvoie TOUS les fichiers du zip (manifest.json inclus),
  // pas seulement ceux du dossier media/. On filtre donc explicitement sur le préfixe "media/".
  // Sans ça, manifest.json est chargé comme un "média" puis réécrit par-dessus le manifest
  // à la sauvegarde suivante → les modifications sont perdues.
  const media: MediaEntry[] = []
  const entries = Object.values(zip.files).filter(f => !f.dir && f.name.startsWith('media/'))
  for (const entry of entries) {
    const data = await entry.async('uint8array')
    const key = entry.name // ex: "media/img-123.png"
    media.push({ key, data })
  }

  return { filePath, manifestJson, media }
}

/**
 * Écrit un fichier de façon atomique : d'abord dans un fichier temporaire
 * voisin, renommé par-dessus la cible une fois l'écriture terminée ET vérifiée.
 *
 * Écrire directement dans la cible laissait un fichier tronqué — donc perdu —
 * dès qu'un plantage, une coupure ou un disque plein survenait en cours de
 * route. Avec le renommage, le fichier d'origine reste intact jusqu'au dernier
 * instant : on a soit l'ancienne version, soit la nouvelle, jamais un mélange.
 *
 * `write` remplit le fichier temporaire et rend le nombre d'octets attendus.
 */
async function writeAtomic(filePath: string, write: (tempPath: string) => Promise<number>) {
  // Même dossier que la cible : un renommage n'est atomique qu'au sein d'un
  // même volume.
  const tempPath = `${filePath}.${process.pid}-${Date.now()}.tmp`
  try {
    const written = await write(tempPath)

    // Vérifie que l'écriture a bien eu lieu (Windows Controlled Folder Access peut
    // bloquer silencieusement en retournant succès sans écrire). La taille
    // suffit : relire le fichier entier doublait le coût de chaque sauvegarde.
    const { size } = await stat(tempPath)
    if (size !== written) {
      throw new Error(
        `Échec d'écriture silencieux : ${size} octets sur disque au lieu de ${written}. ` +
        `Vérifiez que Windows n'a pas bloqué l'accès (Accès contrôlé aux dossiers / Antivirus).`
      )
    }

    await rename(tempPath, filePath)
  } catch (err) {
    await rm(tempPath, { force: true }).catch(() => {})
    throw err
  }
}

/**
 * Le zip du projet est produit en flux vers le disque : l'archive complète n'est
 * plus montée en mémoire (un projet avec des vidéos pèse vite plusieurs
 * centaines de mégaoctets).
 */
async function writeZip(filePath: string, manifestJson: string, media: MediaEntry[]) {
  const zip = new JSZip()
  zip.file('manifest.json', manifestJson)
  for (const m of media) {
    // Garde-fou : un média ne doit jamais pouvoir écraser le manifest.
    if (m.key === 'manifest.json' || !m.key.startsWith('media/')) continue
    zip.file(m.key, m.data, { compression: /^media\/vid-/.test(m.key) ? 'STORE' : 'DEFLATE' })
  }

  await writeAtomic(filePath, async tempPath => {
    let written = 0
    const source = zip.generateNodeStream({ type: 'nodebuffer', compression: 'DEFLATE', streamFiles: true })
    source.on('data', (chunk: Buffer) => { written += chunk.length })
    await pipeline(source, createWriteStream(tempPath))
    return written
  })
}
