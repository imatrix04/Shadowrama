import { dialog, ipcMain } from 'electron'
import { writeFile, readFile } from 'fs/promises'

ipcMain.handle('save-project-as', async (_e, json: string, defaultName: string) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: `${defaultName}.shma`,
    filters: [{ name: 'Shadowrama', extensions: ['shma'] }],
  })
  if (canceled || !filePath) return null
  await writeFile(filePath, json, 'utf-8')
  return filePath
})

ipcMain.handle('save-project', async (_e, filePath: string, json: string) => {
  await writeFile(filePath, json, 'utf-8')
  return filePath
})

ipcMain.handle('open-project', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'Shadowrama', extensions: ['shma'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths[0]) return null

  const filePath = filePaths[0]
  const content = await readFile(filePath, 'utf-8')
  return { filePath, content }
})