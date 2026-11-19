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
    /** Photographie une zone de la fenêtre (pixels CSS). Rend un PNG. */
    captureRect: (rect: { x: number; y: number; width: number; height: number }) => Promise<Uint8Array>
    /** Photographie le contenu d'un bloc « Page web », par identifiant de `<webview>`. Rend un PNG. */
    captureWebview: (id: number) => Promise<Uint8Array>
  }
  fileAPI: {
    saveProjectAs: (manifestJson: string, media: MediaPayload[], defaultName: string) => Promise<string | null>
    saveProject: (filePath: string, manifestJson: string, media: MediaPayload[]) => Promise<string>
    openProject: () => Promise<{ filePath: string; manifestJson: string; media: MediaPayload[] } | null>
    openProjectAt: (filePath: string) => Promise<{ filePath: string; manifestJson: string; media: MediaPayload[] }>
    /** Boîte de dialogue « Importer PowerPoint » : renvoie le contenu du .pptx choisi. */
    openPptx: () => Promise<{ filePath: string; data: Uint8Array } | null>
    /** Boîte « Exporter en PowerPoint ». Rend le nom du fichier choisi, ou null si annulé. */
    pickPptxPath: (defaultName: string) => Promise<string | null>
    /** Écrit le .pptx à l'emplacement choisi par `pickPptxPath`. Rend le nom du fichier. */
    writePptx: (data: Uint8Array) => Promise<string>
  }
  /** Assistant IA (voir electron/ai.ts). Absent hors de l'application de bureau. */
  aiAPI?: {
    getSettings: () => Promise<import('../ai/types').AISettings>
    saveSettings: (patch: { provider?: string; model?: string; consent?: boolean }) => Promise<import('../ai/types').AISettings>
    /** Enregistre la clé (chiffrée côté système). Elle ne peut jamais être relue. */
    setKey: (provider: string, key: string) => Promise<import('../ai/types').AISettings>
    clearKey: (provider: string) => Promise<import('../ai/types').AISettings>
    turn: (request: {
      requestId: string
      provider: string
      system: string
      messages: import('../ai/types').WireMessage[]
      tools: import('../ai/types').ToolDef[]
    }) => Promise<import('../ai/types').TurnResult>
    abort: (requestId: string) => void
  }
}
