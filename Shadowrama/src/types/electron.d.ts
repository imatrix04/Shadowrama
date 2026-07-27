// Surface exposée par les preloads Electron (electron/preload.ts).
// `electronAPI` est optionnel car le renderer peut tourner hors Electron
// (`npm run dev` ouvert dans un navigateur), et le code l'appelle en `?.`.
interface MediaPayload {
  key: string
  data: string
}

interface Window {
  electronAPI?: {
    setFullScreen: (value: boolean) => void
  }
  fileAPI: {
    saveProjectAs: (manifestJson: string, media: MediaPayload[], defaultName: string) => Promise<string | null>
    saveProject: (filePath: string, manifestJson: string, media: MediaPayload[]) => Promise<string>
    openProject: () => Promise<{ filePath: string; manifestJson: string; media: MediaPayload[] } | null>
  }
}
