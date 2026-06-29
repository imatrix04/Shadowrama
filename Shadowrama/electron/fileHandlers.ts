import { dialog, ipcMain } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import JSZip from 'jszip'

interface MediaEntry { key: string; data: string } // data = base64

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
  await writeZip(filePath, manifestJson, media)
  return filePath
})

ipcMain.handle('open-project', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'Shadowrama', extensions: ['shma'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths[0]) return null

  const filePath = filePaths[0]
  const buffer = await readFile(filePath)
  const zip = await JSZip.loadAsync(buffer)

  const manifestFile = zip.file('manifest.json')
  if (!manifestFile) throw new Error('manifest.json manquant')
  const manifestJson = await manifestFile.async('string')

  const media: MediaEntry[] = []
  const mediaFolder = zip.folder('media')
  if (mediaFolder) {
    const entries = Object.values(mediaFolder.files).filter(f => !f.dir)
    for (const entry of entries) {
      const base64 = await entry.async('base64')
      const key = entry.name // ex: "media/img-123.png"
      media.push({ key, data: base64 })
    }
  }

  return { filePath, manifestJson, media }
})

async function writeZip(filePath: string, manifestJson: string, media: MediaEntry[]) {
  const zip = new JSZip()
  zip.file('manifest.json', manifestJson)
  for (const m of media) {
    zip.file(m.key, m.data, { base64: true })
  }
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  await writeFile(filePath, buffer)

  // Vérifie que l'écriture a bien eu lieu (Windows Controlled Folder Access peut bloquer
  // silencieusement en retournant succès sans écrire)
  const verify = await readFile(filePath)
  if (verify.length !== buffer.length) {
    throw new Error(
      `Échec d'écriture silencieux : ${verify.length} octets sur disque au lieu de ${buffer.length}. ` +
      `Vérifiez que Windows n'a pas bloqué l'accès (Accès contrôlé aux dossiers / Antivirus).`
    )
  }
}