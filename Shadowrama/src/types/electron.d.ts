// Surface exposée par les preloads Electron (electron/preload.ts).
// `electronAPI` est optionnel car le renderer peut tourner hors Electron
// (`npm run dev` ouvert dans un navigateur), et le code l'appelle en `?.`.
interface MediaPayload {
  key: string
  /** Octets bruts de l'image. Traversent l'IPC par clonage structuré. */
  data: Uint8Array
}

type UpdateCheckResult =
  | { status: 'available'; version: string }
  | { status: 'up-to-date' }
  | { status: 'dev' }
  | { status: 'error'; message: string }

interface Window {
  electronAPI?: {
    setFullScreen: (value: boolean) => void
    getAppVersion: () => Promise<string>
    checkForUpdates: () => Promise<UpdateCheckResult>
    onWebviewEvent: (callback: (event: { type: 'escape' | 'pointer'; id: number }) => void) => () => void
  }
  fileAPI: {
    saveProjectAs: (manifestJson: string, media: MediaPayload[], defaultName: string) => Promise<string | null>
    saveProject: (filePath: string, manifestJson: string, media: MediaPayload[]) => Promise<string>
    openProject: () => Promise<{ filePath: string; manifestJson: string; media: MediaPayload[] } | null>
    openProjectAt: (filePath: string) => Promise<{ filePath: string; manifestJson: string; media: MediaPayload[] }>
    /** Boîte de dialogue « Importer PowerPoint » : renvoie le contenu du .pptx choisi. */
    openPptx: () => Promise<{ filePath: string; data: Uint8Array } | null>
  }
}
